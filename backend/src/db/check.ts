import { pool } from "./client";

async function main() {
  const id = "WH-selftest-" + Date.now();
  const q = `insert into webhook_events (paypal_event_id, event_type, payload)
             values ($1, 'TEST', '{}')
             on conflict (paypal_event_id) do nothing
             returning id`;

  const first = await pool.query(q, [id]);
  const second = await pool.query(q, [id]);

  console.log("first insert rows:", first.rowCount, "(expect 1)");
  console.log("duplicate insert rows:", second.rowCount, "(expect 0)");

  await pool.query("delete from webhook_events where paypal_event_id = $1", [id]);
  await pool.end();
}

main().catch((e) => {
  console.error("DB check failed:", e.message);
  process.exit(1);
});