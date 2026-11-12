import { z } from "zod";
import { env } from "../config/env";
import { pool } from "../db/client";
import { runWithTenant } from "../db/context";
import { syncFromPayPal } from "../paypal/sync";
import { logger } from "../utils/logger";

// Events that mean "a dispute changed". Each one refreshes the dispute from PayPal.
const DISPUTE_EVENTS = new Set([
  "CUSTOMER.DISPUTE.CREATED",
  "CUSTOMER.DISPUTE.UPDATED",
  "CUSTOMER.DISPUTE.RESOLVED",
]);

const disputeEventSchema = z.object({
  resource: z.object({ dispute_id: z.string().min(1) }),
});

// Which seller receives webhook disputes (one set of Sandbox credentials serves the whole app)
async function resolveWebhookTenant(): Promise<string> {
  if (!env.WEBHOOK_TENANT_EMAIL) {
    throw new Error("WEBHOOK_TENANT_EMAIL is not configured");
  }
  const r = await pool.query("select app_tenant_by_email($1) as id", [env.WEBHOOK_TENANT_EMAIL]);
  const id = r.rows[0]?.id as string | null | undefined;
  if (!id) throw new Error("No user matches WEBHOOK_TENANT_EMAIL. Sign in once with that account first.");
  return id;
}

export async function processEvent(paypalEventId: string): Promise<void> {
  const { rows } = await pool.query(
    `select event_type, payload, processed_at
       from webhook_events where paypal_event_id = $1`,
    [paypalEventId]
  );
  const row = rows[0];
  if (!row || row.processed_at) return;

  if (DISPUTE_EVENTS.has(row.event_type)) {
    const parsed = disputeEventSchema.safeParse(row.payload);
    if (!parsed.success) {
      // Malformed payload: log it and mark processed so we don't loop forever.
      logger.warn({ paypalEventId }, "dispute event has an unexpected shape, skipping");
    } else {
      // A failure here throws, so the worker retries it (up to 5 times)
      const tenantId = await resolveWebhookTenant();
      const summary = await runWithTenant(tenantId, () =>
        syncFromPayPal(tenantId, "paypal-webhook")
      );
      logger.info(
        {
          paypalEventId,
          eventType: row.event_type,
          disputeId: parsed.data.resource.dispute_id,
          imported: summary.imported,
        },
        "dispute synced from webhook"
      );
    }
  }

  await pool.query(
    `update webhook_events set processed_at = now() where paypal_event_id = $1`,
    [paypalEventId]
  );
}