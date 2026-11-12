import { pool } from "../db/client";
import { loadAlerts } from "./alerts";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx src/risk/alertsCli.ts user-A-email");
    process.exit(1);
  }
  const u = await pool.query(`select tenant_id from users where lower(email) = lower($1)`, [email]);
  if (u.rowCount === 0) throw new Error("No user with that email");

  const alerts = await loadAlerts(u.rows[0].tenant_id);
  console.log(`${alerts.length} alert(s)\n`);
  for (const a of alerts) {
    console.log(`[${a.severity.toUpperCase()}] ${a.paypalDisputeId}: ${a.title}`);
    console.log(`   ${a.detail}`);
    if (a.proposedAction) console.log(`   Proposed: ${a.proposedAction.actionType} (needs ${a.proposedAction.needs.join(", ")})`);
  }
  await pool.end();
}

main().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});