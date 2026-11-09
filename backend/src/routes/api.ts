import { Router, type Request, type Response, type RequestHandler } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { pool } from "../db/client";
import { withTx } from "../db/tx";
import { requireAuth, requireOwner } from "../middleware/auth";
import { computeDeadline, RULES_LAST_CHECKED } from "../rules/deadlines";
import { buildChecklist, type DisputeType } from "../rules/disputeTypes";
import { compareOptions } from "../rules/costs";
import { generateDraft, DraftError, MAX_GENERATIONS } from "../ai/draft";
import { createAction, approveAction, rejectAction, GateError } from "../actions/gate";
import { verifyChain, appendAudit } from "../audit/log";
import { verifyPassword } from "../auth/stepUp";
import { seedTenant } from "../db/seedData";

export const apiRouter = Router();
apiRouter.use(requireAuth);

// Approvals and password re-checks: strict
const approveLimiter = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many approval attempts, wait a minute" },
});

// Other write actions (draft, create action, demo data): looser
const sensitiveLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, wait a minute" },
});

const idSchema = z.string().uuid();

// Runs an async handler and turns known domain errors into clean HTTP codes
const wrap =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch((e) => {
      if (e instanceof GateError) {
        const status = { not_found: 404, not_pending: 409, blocked: 422, invalid: 400 }[e.code];
        res.status(status).json({ error: e.message });
        return;
      }
      if (e instanceof DraftError) {
        const status = { not_found: 404, limit_reached: 429, ai_failed: 502 }[e.code];
        res.status(status).json({ error: e.message });
        return;
      }
      next(e);
    });
  };

function shapeDispute(row: any, recordTypes: string[]) {
  const deadline = computeDeadline({
    responseDueAt: row.response_due_at,
    openedAt: row.opened_at,
  });
  const checklist = buildChecklist((row.dispute_type ?? "OTHER") as DisputeType, recordTypes);
  return {
    id: row.id as string,
    paypalDisputeId: row.paypal_dispute_id as string,
    type: row.dispute_type as string | null,
    reason: row.reason as string | null,
    status: row.status as string,
    amountMinor: row.amount_minor === null ? null : Number(row.amount_minor),
    currency: row.currency as string | null,
    openedAt: row.opened_at,
    responseDueAt: row.response_due_at,
    deadline,
    rulesLastChecked: RULES_LAST_CHECKED,
    evidenceCompletenessPercent: checklist.completenessPercent,
    missingRequired: checklist.missingRequired,
    checklist,
    aiStatus: row.ai_status as string,
    generationsLeft: Math.max(0, MAX_GENERATIONS - Number(row.ai_generations)),
  };
}

apiRouter.get("/me", (req, res) => {
  const a = req.auth!;
  res.json({
    email: a.email,
    role: a.role,
    tenantId: a.tenantId,
    rulesLastChecked: RULES_LAST_CHECKED,
  });
});

apiRouter.post(
  "/demo/seed",
  sensitiveLimiter,
  requireOwner,
  wrap(async (req, res) => {
    const a = req.auth!;
    await seedTenant(a.tenantId);
    await withTx((c) =>
      appendAudit(c, {
        tenantId: a.tenantId,
        actor: a.email ?? a.userId,
        action: "demo.seeded",
        details: { note: "Loaded 3 fictional demo disputes" },
      })
    );
    res.json({ ok: true });
  })
);

apiRouter.get(
  "/disputes",
  wrap(async (req, res) => {
    const { rows } = await pool.query(
      `select d.*,
              coalesce(array_agg(r.record_type) filter (where r.record_type is not null), '{}') as record_types
         from disputes d
         left join records r on r.dispute_id = d.id and r.tenant_id = d.tenant_id
        where d.tenant_id = $1
        group by d.id
        order by d.response_due_at nulls last
        limit 100`,
      [req.auth!.tenantId]
    );
    res.json({ disputes: rows.map((r) => shapeDispute(r, r.record_types)) });
  })
);

apiRouter.get(
  "/disputes/:id",
  wrap(async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const tenantId = req.auth!.tenantId;

    const d = await pool.query(`select * from disputes where id = $1 and tenant_id = $2`, [
      id.data,
      tenantId,
    ]);
    if (d.rowCount === 0) {
      res.status(404).json({ error: "Dispute not found" });
      return;
    }

    const [recs, msgs, acts] = await Promise.all([
      pool.query(
        `select id, record_type, source, content from records
          where dispute_id = $1 and tenant_id = $2 order by created_at, id`,
        [id.data, tenantId]
      ),
      pool.query(
        `select id, sender_role, body, injection_flag, flag_reason, created_at from messages
          where dispute_id = $1 and tenant_id = $2 order by created_at, id`,
        [id.data, tenantId]
      ),
      pool.query(
        `select id, action_type, amount_minor, currency, status, expires_at, created_at,
                created_by, decided_by
           from pending_actions
          where dispute_id = $1 and tenant_id = $2 order by created_at desc limit 20`,
        [id.data, tenantId]
      ),
    ]);

    const row = d.rows[0];
    const dispute = shapeDispute(row, recs.rows.map((r) => r.record_type));

    const options =
      dispute.amountMinor !== null && dispute.currency
        ? compareOptions({
            amountMinor: dispute.amountMinor,
            currency: dispute.currency,
            deadlineStatus: dispute.deadline?.status ?? "ok",
            evidenceCompletenessPercent: dispute.evidenceCompletenessPercent,
          })
        : null;

    res.json({
      dispute,
      records: recs.rows,
      messages: msgs.rows, // render as plain text only
      options,
      draft: row.ai_draft,
      actions: acts.rows.map((a) => ({
        ...a,
        amount_minor: a.amount_minor === null ? null : Number(a.amount_minor),
      })),
    });
  })
);

apiRouter.post(
  "/disputes/:id/draft",
  sensitiveLimiter,
  requireOwner,
  wrap(async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const a = req.auth!;
    const draft = await generateDraft(id.data, a.tenantId);
    await withTx((c) =>
      appendAudit(c, {
        tenantId: a.tenantId,
        actor: a.email ?? a.userId,
        action: "draft.generated",
        targetType: "dispute",
        targetId: id.data,
        details: {
          kept: draft.statements.length,
          dropped: draft.dropped.length,
          flaggedMessages: draft.flaggedMessages.length,
          model: draft.model,
        },
      })
    );
    res.json({ draft });
  })
);

apiRouter.post(
  "/actions",
  sensitiveLimiter,
  requireOwner,
  wrap(async (req, res) => {
    const a = req.auth!;
    const created = await createAction(a.tenantId, req.body, a.email ?? a.userId);
    res.status(201).json(created);
  })
);

apiRouter.post(
  "/actions/:id/approve",
  approveLimiter,
  requireOwner,
  wrap(async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    const body = z.object({ password: z.string().min(1).max(200) }).safeParse(req.body);
    if (!id.success || !body.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const a = req.auth!;
    const ok = await verifyPassword(a.email ?? "", body.data.password);
    if (!ok) {
      await withTx((c) =>
        appendAudit(c, {
          tenantId: a.tenantId,
          actor: a.email ?? a.userId,
          action: "stepup.failed",
          targetType: "pending_action",
          targetId: id.data,
        })
      );
      res.status(403).json({ error: "Re-authentication failed" });
      return;
    }
    const out = await approveAction(a.tenantId, id.data, a.email ?? a.userId);
    res.json(out);
  })
);

apiRouter.post(
  "/actions/:id/reject",
  sensitiveLimiter,
  requireOwner,
  wrap(async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const a = req.auth!;
    res.json(await rejectAction(a.tenantId, id.data, a.email ?? a.userId));
  })
);

apiRouter.get(
  "/audit",
  wrap(async (req, res) => {
    const { rows } = await pool.query(
      `select seq, actor, action, target_type, target_id, details, hash, created_at
         from audit_log where tenant_id = $1 order by seq desc limit 100`,
      [req.auth!.tenantId]
    );
    res.json({ entries: rows.map((r) => ({ ...r, seq: Number(r.seq) })) });
  })
);

apiRouter.get(
  "/audit/verify",
  wrap(async (req, res) => {
    res.json(await verifyChain(req.auth!.tenantId));
  })
);