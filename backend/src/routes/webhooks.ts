import { processEvent } from "../disputes/ingest";
import { Router } from "express";
import { verifyWebhookSignature } from "../paypal/verifyWebhook";
import { pool } from "../db/client";

export const webhooksRouter = Router();

webhooksRouter.post("/webhooks/paypal", async (req, res) => {
  const h = req.headers;
  const authAlgo = h["paypal-auth-algo"];
  const certUrl = h["paypal-cert-url"];
  const transmissionId = h["paypal-transmission-id"];
  const transmissionSig = h["paypal-transmission-sig"];
  const transmissionTime = h["paypal-transmission-time"];

  if (
    typeof authAlgo !== "string" ||
    typeof certUrl !== "string" ||
    typeof transmissionId !== "string" ||
    typeof transmissionSig !== "string" ||
    typeof transmissionTime !== "string"
  ) {
    res.status(400).json({ error: "Missing PayPal signature headers" });
    return;
  }

  const verified = await verifyWebhookSignature(
    { authAlgo, certUrl, transmissionId, transmissionSig, transmissionTime },
    req.body
  );

  if (!verified) {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  const event = req.body as { id?: unknown; event_type?: unknown };
  if (typeof event.id !== "string" || typeof event.event_type !== "string") {
    res.status(400).json({ error: "Malformed event" });
    return;
  }

  try {
    const result = await pool.query(
      `insert into webhook_events (paypal_event_id, event_type, payload)
       values ($1, $2, $3)
       on conflict (paypal_event_id) do nothing
       returning id`,
      [event.id, event.event_type, JSON.stringify(req.body)]
    );

    const isNew = (result.rowCount ?? 0) > 0;
    console.log(
      `Verified webhook: ${event.event_type} (${event.id}) ${isNew ? "stored" : "duplicate, ignored"}`
    );

    // Duplicates still get 200 so PayPal stops retrying.
        res.status(200).json({ received: true, duplicate: !isNew });

    if (isNew) {
      // Runs after PayPal already got its 200
      processEvent(event.id).catch((err) =>
        console.error("Background processing failed:", (err as Error).message)
      );
    }
  } catch (err) {
    console.error("Failed to store webhook event:", (err as Error).message);
    // 500 makes PayPal retry later.
    res.status(500).json({ error: "Could not store event" });
  }
});