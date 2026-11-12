import { pool } from "../db/client";
import { processEvent } from "../disputes/ingest";
import { logger } from "../utils/logger";

const MAX_ATTEMPTS = 5;

const SWEEP_LOCK_KEY = 872341;

let running = false;
let timer: NodeJS.Timeout | null = null;

export async function processPending(): Promise<void> {
  if (running) return;
  running = true;

  
  const lockClient = await pool.connect();
  try {
    const lock = await lockClient.query("select pg_try_advisory_lock($1::bigint) as got", [
      SWEEP_LOCK_KEY,
    ]);
    if (!lock.rows[0].got) return; 

    try {
      const { rows } = await pool.query(
        `select paypal_event_id from webhook_events
          where processed_at is null and attempts < $1
          order by created_at limit 20`,
        [MAX_ATTEMPTS]
      );

      for (const r of rows) {
        try {
          await processEvent(r.paypal_event_id);
        } catch (err) {
          const message = (err as Error).message.slice(0, 300);
          const upd = await pool.query(
            `update webhook_events
                set attempts = attempts + 1, last_error = $2
              where paypal_event_id = $1
              returning attempts`,
            [r.paypal_event_id, message]
          );
          const attempts = upd.rows[0]?.attempts ?? 0;
          if (attempts >= MAX_ATTEMPTS) {
            logger.error({ eventId: r.paypal_event_id, message }, "giving up on event");
          } else {
            logger.warn({ eventId: r.paypal_event_id, attempts, message }, "event failed, will retry");
          }
        }
      }
    } finally {
      await lockClient.query("select pg_advisory_unlock($1::bigint)", [SWEEP_LOCK_KEY]);
    }
  } catch (err) {
    logger.error({ err }, "worker sweep failed");
  } finally {
    lockClient.release();
    running = false;
  }
}

export function startWorker(): void {
  void processPending(); // catches anything missed while the server was down
  timer = setInterval(() => void processPending(), 60_000);
}

export function stopWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}