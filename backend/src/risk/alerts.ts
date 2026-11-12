import { pool } from "../db/client";
import { computeSellerDeadline } from "../rules/sellerDeadline";
import { buildChecklist, type DisputeType } from "../rules/disputeTypes";
import { computeAlerts, type Alert, type RiskInput } from "../rules/risks";
import { detectInjection } from "../ai/injection";

export async function loadAlerts(tenantId: string): Promise<Alert[]> {
  const disputes = await pool.query(
    `select d.id, d.paypal_dispute_id, d.dispute_type, d.status, d.opened_at, d.response_due_at,
            coalesce(
              (select array_agg(r.record_type) from records r
                where r.dispute_id = d.id and r.tenant_id = d.tenant_id),
              '{}'
            ) as record_types
       from disputes d
      where d.tenant_id = $1 and d.status <> 'RESOLVED'
      order by d.response_due_at nulls last
      limit 100`,
    [tenantId]
  );


  const msgs = await pool.query(
    `select dispute_id, body from messages where tenant_id = $1 and sender_role = 'buyer'`,
    [tenantId]
  );
  const flagged = new Map<string, number>();
  for (const m of msgs.rows) {
    if (detectInjection(m.body).flagged) {
      flagged.set(m.dispute_id, (flagged.get(m.dispute_id) ?? 0) + 1);
    }
  }

  const inputs: RiskInput[] = disputes.rows.map((r) => {
    const type = (r.dispute_type ?? "OTHER") as DisputeType;
    const recordTypes: string[] = r.record_types ?? [];
    const deadline = computeSellerDeadline({
      responseDueAt: r.response_due_at,
      openedAt: r.opened_at,
      status: r.status,
    });
    const checklist = buildChecklist(type, recordTypes);
    return {
      disputeId: r.id,
      paypalDisputeId: r.paypal_dispute_id,
      type,
      deadlineStatus: deadline?.status ?? null,
      hoursLeft: deadline?.hoursLeft ?? null,
      daysLeft: deadline?.daysLeft ?? null,
      completenessPercent: checklist.completenessPercent,
      recordTypes,
      flaggedMessages: flagged.get(r.id) ?? 0,
    };
  });

  return computeAlerts(inputs);
}