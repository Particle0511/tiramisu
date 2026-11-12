import { pool } from "../db/client";
import { createAction, GateError } from "../actions/gate";
import { buildResponseMessage } from "./message";


export async function createRespondAction(tenantId: string, disputeId: string, actor: string) {
  const { rows } = await pool.query(
    `select ai_draft from disputes where id = $1 and tenant_id = $2`,
    [disputeId, tenantId]
  );
  if (rows.length === 0) throw new GateError("not_found", "Dispute not found");

  const message = buildResponseMessage(rows[0].ai_draft);
  if (!message) {
    throw new GateError("invalid", "Generate a draft with at least one supported statement first");
  }


  const dup = await pool.query(
    `select 1 from pending_actions
      where dispute_id = $1 and tenant_id = $2 and action_type = 'RESPOND'
        and status in ('pending', 'approved', 'executed')
        and payload->>'message' = $3
      limit 1`,
    [disputeId, tenantId, message]
  );
  if (dup.rowCount) {
    throw new GateError(
      "not_pending",
      "This response was already sent or is waiting for approval"
    );
  }

  const created = await createAction(
    tenantId,
    { disputeId, actionType: "RESPOND", payload: { message } },
    actor
  );
  return { ...created, message };
}