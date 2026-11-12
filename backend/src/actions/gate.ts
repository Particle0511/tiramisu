import { z } from "zod";
import { withTx } from "../db/tx";
import { appendAudit } from "../audit/log";
import { checkLimits, canTransition, type ActionStatus } from "./limits";

export const ACTION_TTL_MS = 24 * 60 * 60 * 1000;

export class GateError extends Error {
  constructor(
    public code: "not_found" | "not_pending" | "blocked" | "invalid",
    message: string
  ) {
    super(message);
  }
}

const createSchema = z.object({
  disputeId: z.string().uuid(),
  actionType: z.enum(["REFUND", "UPLOAD_TRACKING", "RESPOND"]),
  amountMinor: z.number().int().positive().optional(),
  currency: z.string().length(3).optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export type ExecutableAction = {
  id: string;
  disputeId: string;
  actionType: string;
  amountMinor: number | null;
  currency: string | null;
  payload: unknown;
};
export type Executor = (a: ExecutableAction) => Promise<Record<string, unknown>>;


export const simulatedExecutor: Executor = async (a) => ({
  simulated: true,
  note: "No PayPal call was made",
  actionType: a.actionType,
});


export async function createAction(tenantId: string, rawInput: unknown, createdBy: string) {
  const parsed = createSchema.safeParse(rawInput);
  if (!parsed.success) throw new GateError("invalid", "Invalid action");
  const input = parsed.data;
  if (input.actionType === "REFUND" && (!input.amountMinor || !input.currency)) {
    throw new GateError("invalid", "A refund needs an amount and a currency");
  }
  const currency = input.currency ? input.currency.toUpperCase() : null;

  return withTx(async (c) => {
    const d = await c.query(
      `select id from disputes where id = $1 and tenant_id = $2`,
      [input.disputeId, tenantId]
    );
    if (d.rowCount === 0) throw new GateError("not_found", "Dispute not found");

    const ins = await c.query(
      `insert into pending_actions
         (tenant_id, dispute_id, action_type, payload, amount_minor, currency, created_by, expires_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       returning id, status, expires_at`,
      [
        tenantId, input.disputeId, input.actionType, JSON.stringify(input.payload),
        input.amountMinor ?? null, currency, createdBy,
        new Date(Date.now() + ACTION_TTL_MS),
      ]
    );
    const row = ins.rows[0];

    await appendAudit(c, {
      tenantId,
      actor: createdBy,
      action: "action.created",
      targetType: "pending_action",
      targetId: row.id,
      details: {
        actionType: input.actionType,
        amountMinor: input.amountMinor ?? null,
        currency,
        disputeId: input.disputeId,
      },
    });

    return {
      id: row.id as string,
      status: row.status as ActionStatus,
      expiresAt: row.expires_at as Date,
    };
  });
}

export async function approveAction(
  tenantId: string,
  actionId: string,
  approver: string,
  executor: Executor = simulatedExecutor
): Promise<{ status: "executed" | "failed"; result?: unknown; error?: string }> {
  type Phase1 =
    | { kind: "blocked"; reason: string }
    | { kind: "ok"; action: ExecutableAction };


  const phase1 = await withTx<Phase1>(async (c) => {
    const { rows } = await c.query(
      `select a.id, a.dispute_id, a.action_type, a.amount_minor, a.currency,
              a.payload, a.status, a.expires_at,
              d.amount_minor as d_amount, d.currency as d_currency,
              t.max_refund_minor
         from pending_actions a
         join disputes d on d.id = a.dispute_id
         join tenants t on t.id = a.tenant_id
        where a.id = $1 and a.tenant_id = $2
        for update of a`,
      [actionId, tenantId]
    );
    const a = rows[0];
    if (!a) throw new GateError("not_found", "Action not found");
    if (!canTransition(a.status, "approved")) {
      throw new GateError("not_pending", `Action is already ${a.status}`);
    }

    const amountMinor = a.amount_minor === null ? null : Number(a.amount_minor);
    const check = checkLimits({
      actionType: a.action_type,
      amountMinor,
      currency: a.currency,
      maxRefundMinor: Number(a.max_refund_minor),
      disputeAmountMinor: a.d_amount === null ? null : Number(a.d_amount),
      disputeCurrency: a.d_currency,
      expiresAt: a.expires_at,
    });

    if (!check.ok) {
      if (check.expired) {
        await c.query(
          `update pending_actions set status = 'expired' where id = $1 and tenant_id = $2`,
          [actionId, tenantId]
        );
      }
      await appendAudit(c, {
        tenantId,
        actor: approver,
        action: check.expired ? "action.expired" : "action.blocked",
        targetType: "pending_action",
        targetId: actionId,
        details: { reason: check.reason },
      });
      return { kind: "blocked", reason: check.reason };
    }

    await c.query(
      `update pending_actions
          set status = 'approved', decided_by = $3, decided_at = now()
        where id = $1 and tenant_id = $2`,
      [actionId, tenantId, approver]
    );
    await appendAudit(c, {
      tenantId,
      actor: approver,
      action: "action.approved",
      targetType: "pending_action",
      targetId: actionId,
      details: { actionType: a.action_type, amountMinor, currency: a.currency },
    });

    return {
      kind: "ok",
      action: {
        id: a.id,
        disputeId: a.dispute_id,
        actionType: a.action_type,
        amountMinor,
        currency: a.currency,
        payload: a.payload,
      },
    };
  });

  if (phase1.kind === "blocked") throw new GateError("blocked", phase1.reason);


  let result: Record<string, unknown> | undefined;
  let failure: string | null = null;
  try {
    result = await executor(phase1.action);
  } catch (e) {
    failure = (e as Error).message;
  }

  await withTx(async (c) => {
    if (failure === null) {
      await c.query(
        `update pending_actions set status = 'executed', result = $3 where id = $1 and tenant_id = $2`,
        [actionId, tenantId, JSON.stringify(result ?? {})]
      );
      await appendAudit(c, {
        tenantId, actor: "system", action: "action.executed",
        targetType: "pending_action", targetId: actionId,
      });
    } else {
      await c.query(
        `update pending_actions set status = 'failed', result = $3 where id = $1 and tenant_id = $2`,
        [actionId, tenantId, JSON.stringify({ error: failure })]
      );
      await appendAudit(c, {
        tenantId, actor: "system", action: "action.failed",
        targetType: "pending_action", targetId: actionId,
        details: { error: failure },
      });
    }
  });

  return failure === null ? { status: "executed", result } : { status: "failed", error: failure };
}

export async function rejectAction(tenantId: string, actionId: string, rejector: string) {
  await withTx(async (c) => {
    const { rows } = await c.query(
      `select status from pending_actions where id = $1 and tenant_id = $2 for update`,
      [actionId, tenantId]
    );
    if (!rows[0]) throw new GateError("not_found", "Action not found");
    if (!canTransition(rows[0].status, "rejected")) {
      throw new GateError("not_pending", `Action is already ${rows[0].status}`);
    }
    await c.query(
      `update pending_actions
          set status = 'rejected', decided_by = $3, decided_at = now()
        where id = $1 and tenant_id = $2`,
      [actionId, tenantId, rejector]
    );
    await appendAudit(c, {
      tenantId, actor: rejector, action: "action.rejected",
      targetType: "pending_action", targetId: actionId,
    });
  });
  return { status: "rejected" as const };
}