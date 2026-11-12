import { pool } from "../db/client";
import { syncFromPayPal } from "./sync";
import { buildChecklist, type DisputeType } from "../rules/disputeTypes";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx src/paypal/syncCli.ts your-user-A-email");
    process.exit(1);
  }

  const u = await pool.query(`select tenant_id from users where lower(email) = lower($1)`, [email]);
  if (u.rowCount === 0) {
    console.error("No user with that email. Sign in once through the API test first.");
    process.exit(1);
  }
  const tenantId = u.rows[0].tenant_id as string;

  const summary = await syncFromPayPal(tenantId, email);
  console.log("Sync summary:", JSON.stringify(summary, null, 2));

  const rows = await pool.query(
    `select id, paypal_dispute_id, dispute_type, status, amount_minor, currency, response_due_at
       from disputes where tenant_id = $1 and paypal_dispute_id not like 'DEMO-%'`,
    [tenantId]
  );

  for (const d of rows.rows) {
    console.log("\nDispute:", d.paypal_dispute_id, d.dispute_type, d.status, d.amount_minor, d.currency);
    console.log("Respond by:", d.response_due_at);

    const recs = await pool.query(
      `select record_type, content from records where dispute_id = $1 and tenant_id = $2 order by created_at, id`,
      [d.id, tenantId]
    );
    for (const r of recs.rows) console.log(`  [${r.record_type}] ${r.content}`);

    const msgs = await pool.query(
      `select sender_role, body, injection_flag from messages where dispute_id = $1 and tenant_id = $2`,
      [d.id, tenantId]
    );
    for (const m of msgs.rows) console.log(`  message (${m.sender_role}, flagged=${m.injection_flag}): ${m.body}`);

    const cl = buildChecklist(d.dispute_type as DisputeType, recs.rows.map((r) => r.record_type));
    console.log(`Evidence completeness: ${cl.completenessPercent}%`, "| missing:", cl.missingRequired.join(", ") || "none");
  }
  await pool.end();
}

main().catch((e) => {
  console.error("Sync failed:", e.message);
  process.exit(1);
});