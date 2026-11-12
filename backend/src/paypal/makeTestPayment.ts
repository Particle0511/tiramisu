import readline from "readline";
import { randomUUID } from "crypto";
import { env } from "../config/env";
import { getAccessToken } from "./client";

async function main() {
  const token = await getAccessToken();
  const base = `${env.PAYPAL_BASE_URL}/v2/checkout/orders`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };


  const create = await fetch(base, {
    method: "POST",
    headers: { ...headers, "PayPal-Request-Id": randomUUID() },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          description: "Handmade tote bag (test order)",
          amount: { currency_code: "USD", value: "85.00" },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            return_url: "https://example.com/return",
            cancel_url: "https://example.com/cancel",
            user_action: "PAY_NOW",
            shipping_preference: "GET_FROM_FILE",
          },
        },
      },
    }),
  });

  const order: any = await create.json();
  if (!create.ok) {
    console.error("Create order failed:", create.status, order?.name, order?.message);
    process.exit(1);
  }

  const link = (order.links as { rel: string; href: string }[]).find(
    (l) => l.rel === "payer-action" || l.rel === "approve"
  );
  console.log("\nOrder created:", order.id);
  console.log("\n1) Open this link in a browser window and log in as the BUYER:");
  console.log(link?.href ?? "(no approval link found)");
  console.log("\n2) Click Pay Now. The page may then show an example.com error. That is fine.");


  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise<void>((resolve) =>
    rl.question("\n3) Come back here and press ENTER after you clicked Pay Now... ", () => {
      rl.close();
      resolve();
    })
  );

  const cap = await fetch(`${base}/${order.id}/capture`, {
    method: "POST",
    headers: { ...headers, "PayPal-Request-Id": randomUUID() },
    body: "{}",
  });
  const done: any = await cap.json();
  if (!cap.ok) {
    console.error("Capture failed:", cap.status, done?.name, done?.message);
    process.exit(1);
  }

  const capture = done?.purchase_units?.[0]?.payments?.captures?.[0];
  console.log("\nPayment complete. Status:", done.status);
  console.log("Capture / transaction ID:", capture?.id);
}

main().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});