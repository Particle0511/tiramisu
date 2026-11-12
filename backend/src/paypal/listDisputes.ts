import { env } from "../config/env";
import { getAccessToken } from "./client";

async function main() {
  const token = await getAccessToken();
  const res = await fetch(
    `${env.PAYPAL_BASE_URL}/v1/customer/disputes?page_size=10`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data: any = await res.json().catch(() => ({}));

  console.log("HTTP status:", res.status);
  if (!res.ok) {
    console.log("PayPal says:", data?.name, data?.message);
    return;
  }

  const items: any[] = data.items ?? [];
  console.log(`Found ${items.length} dispute(s)`);
  for (const d of items) {
    console.log({
      id: d.dispute_id,
      reason: d.reason,
      status: d.status,
      stage: d.dispute_life_cycle_stage,
      amount: d.dispute_amount,
      opened: d.create_time,
      sellerRespondBy: d.seller_response_due_date,
    });
  }
}

main().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});