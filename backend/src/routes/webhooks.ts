import { Router } from "express";
import { verifyWebhookSignature } from "../paypal/verifyWebhook";
import { isPayPalCertUrl, checkTransmissionTime } from "../paypal/webhookGuard";
import { pool } from "../db/client";
import { processEvent } from "../disputes/ingest";
import { logger } from "../utils/logger";

export const webhooksRouter = Router();

webhooksRouter.post("/webhooks/paypal", async (req, res, next) => {
  try {
    
    const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : null;
    if (!raw) {
      res.status(400).json({ error: "Expected a JSON body" });
      return;
    }

    let event: { id?: unknown; event_type?: unknown };
    try {
      event = JSON.parse(raw);
    } catch {
      res.status(400).json({ error: "Malformed JSON" });
      return;
    }

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

    if (!isPayPalCertUrl(certUrl)) {
      res.status(400).json({ error: "Invalid certificate URL" });
      return;
    }
    const timeCheck = checkTransmissionTime(transmissionTime);
    if (!timeCheck.ok) {
      res.status(400).json({ error: timeCheck.reason });
      return;
    }

    const verified = await verifyWebhookSignature(
      { authAlgo, certUrl, transmissionId, transmissionSig, transmissionTime },
      raw
    );
    if (!verified) {
      logger.warn({ transmissionId }, "webhook rejected: invalid signature");
      res.status(401).json({ error: "Invalid webhook signature" });
      return;
    }

    if (typeof event.id !== "string" || typeof event.event_type !== "string") {
      res.status(400).json({ error: "Malformed event" });
      return;
    }
    const eventId = event.id;
    const eventType = event.event_type;

    try {
      const result = await pool.query(
        `insert into webhook_events (paypal_event_id, event_type, payload)
         values ($1, $2, $3)
         on conflict (paypal_event_id) do nothing
         returning id`,
        [eventId, eventType, raw]
      );

      const isNew = (result.rowCount ?? 0) > 0;
      logger.info({ eventId, eventType, duplicate: !isNew }, "verified webhook received");


      res.status(200).json({ received: true, duplicate: !isNew });

      if (isNew) {
 
        processEvent(eventId).catch((err) =>
          logger.error({ err, eventId }, "background processing failed")
        );
      }
    } catch (err) {
      logger.error({ err, eventId }, "failed to store webhook event");
     
      res.status(500).json({ error: "Could not store event" });
    }
  } catch (err) {
    next(err);
  }
});