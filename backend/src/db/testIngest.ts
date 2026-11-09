import { pool } from "./client";
import { processEvent } from "../disputes/ingest";

async function main() {
  const eventId = "WH-test-" + Date.now();
  const disputeId = "PP-D-TEST-" + Date.now();

  const payload = {
    id: eventId,
    event_type: "CUSTOMER.DISPUTE.CREATED",
    resource: {
      dispute_id: disputeId,
      reason: "ITEM_NOT_RECEIVED",
      status: "OPEN",
      create_time: new Date().toISOString(),
      seller_response_due_date: new Date(Date.now() + 10 * 86400000).toISOString(),
      dispute_amount: { currency_code: "USD", value: "85.00" },
    },
  };

  await pool.query(
    `insert into webhook_events (paypal_event_id, event_type, payload)
     values ($1, $2, $3)`,
    [eventId, payload.event_type, JSON.stringify(payload)]
  );

  await processEvent(eventId);
  await processEvent(eventId); // second call must change nothing

  const { rows } = await pool.query(
    `select dispute_type, status, amount_minor, currency, response_due_at, ai_status
       from disputes where paypal_dispute_id = $1`,
    [disputeId]
  );
  console.log("dispute rows:", rows.length, "(expect 1)");
  console.log(rows[0]);

  await pool.query("delete from disputes where paypal_dispute_id = $1", [disputeId]);
  await pool.query("delete from webhook_events where paypal_event_id = $1", [eventId]);
  await pool.end();
}

main().catch((e) => {
  console.error("Test failed:", e.message);
  process.exit(1);
});