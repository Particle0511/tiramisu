import { pool } from "../db/client";
import { processEvent } from "../disputes/ingest";

let running = false;

export async function processPending(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const { rows } = await pool.query(
      `select paypal_event_id from webhook_events
        where processed_at is null
        order by created_at limit 20`
    );
    for (const r of rows) {
      try {
        await processEvent(r.paypal_event_id);
      } catch (err) {
        console.error(
          `Processing ${r.paypal_event_id} failed:`,
          (err as Error).message
        );
      }
    }
  } finally {
    running = false;
  }
}

export function startWorker(): void {
  void processPending(); // catches anything missed while the server was down
  setInterval(() => void processPending(), 60_000);
}