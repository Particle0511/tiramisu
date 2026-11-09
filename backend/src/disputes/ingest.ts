import { z } from "zod";
import { pool } from "../db/client";

// TEMPORARY: every dispute goes to the demo seller.
// Real tenant mapping comes with login and PayPal connections.
const DEMO_TENANT_ID = "11111111-1111-1111-1111-111111111111";

const resourceSchema = z.object({
  dispute_id: z.string().min(1),
  reason: z.string().optional(),
  status: z.string().optional(),
  create_time: z.string().optional(),
  seller_response_due_date: z.string().optional(),
  dispute_amount: z
    .object({
      currency_code: z.string().min(3).max(3),
      value: z.coerce.string(),
    })
    .optional(),
});

const ZERO_DECIMAL = new Set(["JPY", "HUF", "TWD"]);

// "85.00" -> 8500 (whole minor units, no floating point math)
function toMinor(value: string, currency: string): number {
  const decimals = ZERO_DECIMAL.has(currency) ? 0 : 2;
  const [whole, frac = ""] = value.split(".");
  const fracPart = frac.padEnd(decimals, "0").slice(0, decimals);
  return Number(whole) * 10 ** decimals + (decimals ? Number(fracPart) : 0);
}

function mapType(reason?: string): string {
  switch (reason) {
    case "ITEM_NOT_RECEIVED":
      return "ITEM_NOT_RECEIVED";
    case "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED":
      return "ITEM_NOT_AS_DESCRIBED";
    case "UNAUTHORISED":
      return "UNAUTHORIZED";
    default:
      return "OTHER";
  }
}

export async function processEvent(paypalEventId: string): Promise<void> {
  const { rows } = await pool.query(
    `select event_type, payload, processed_at
       from webhook_events where paypal_event_id = $1`,
    [paypalEventId]
  );
  const row = rows[0];
  if (!row || row.processed_at) return;

  if (row.event_type === "CUSTOMER.DISPUTE.CREATED") {
    const parsed = resourceSchema.safeParse(row.payload?.resource);
    if (!parsed.success) {
      // Malformed payload: log it and mark processed so we don't loop forever.
      console.error(`Event ${paypalEventId} has an unexpected shape, skipping`);
    } else {
      const r = parsed.data;
      const currency = r.dispute_amount?.currency_code ?? null;
      const amountMinor =
        r.dispute_amount && currency
          ? toMinor(r.dispute_amount.value, currency)
          : null;

      await pool.query(
        `insert into disputes
           (tenant_id, paypal_dispute_id, dispute_type, reason, status,
            amount_minor, currency, opened_at, response_due_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         on conflict (paypal_dispute_id) do nothing`,
        [
          DEMO_TENANT_ID,
          r.dispute_id,
          mapType(r.reason),
          r.reason ?? null,
          r.status ?? "OPEN",
          amountMinor,
          currency,
          r.create_time ?? null,
          r.seller_response_due_date ?? null,
        ]
      );
      console.log(`Dispute stored: ${r.dispute_id}`);
    }
  }

  await pool.query(
    `update webhook_events set processed_at = now() where paypal_event_id = $1`,
    [paypalEventId]
  );
}