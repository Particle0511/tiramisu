import { env } from "../config/env";
import { getAccessToken } from "./client";

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error("Usage: npx tsx src/paypal/getDispute.ts PP-R-XXXX");
    process.exit(1);
  }

  const token = await getAccessToken();
  const res = await fetch(
    `${env.PAYPAL_BASE_URL}/v1/customer/disputes/${encodeURIComponent(id)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const d: any = await res.json().catch(() => ({}));

  console.log("HTTP status:", res.status);
  if (!res.ok) {
    console.log("PayPal says:", d?.name, d?.message);
    return;
  }

  console.log({
    id: d.dispute_id,
    reason: d.reason,
    status: d.status,
    stage: d.dispute_life_cycle_stage,
    amount: d.dispute_amount,
    opened: d.create_time,
    sellerRespondBy: d.seller_response_due_date,
    disputedTransactions: (d.disputed_transactions ?? []).map((t: any) => ({
      id: t.seller_transaction_id,
      invoice: t.invoice_number,
    })),
    messages: (d.messages ?? []).map((m: any) => ({ by: m.posted_by, text: m.content })),
    offer: d.offer,
  });
  console.log("Allowed seller responses:", d.allowed_response_options);
}

main().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});