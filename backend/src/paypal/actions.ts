import { z } from "zod";
import { env } from "../config/env";
import { pool } from "../db/client";
import { getAccessToken, type PayPalCreds } from "./client";
import { getDispute } from "./api";
import { resolveCredentials } from "./credentials";
import { fromMinor } from "../rules/money";
import type { Executor } from "../actions/gate";

const trackingSchema = z.object({
  trackingNumber: z.string().trim().min(5).max(40).regex(/^[A-Za-z0-9-]+$/),
  carrier: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9 ._-]+$/),
});

const offerSchema = z.object({
  note: z.string().trim().min(1).max(2000).default("Offering a refund to resolve this dispute."),
});

const messageSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

async function paypalPost(path: string, body: unknown, requestId: string, creds: PayPalCreds): Promise<any> {
  const token = await getAccessToken(creds);
  const res = await fetch(`${env.PAYPAL_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
  
      "PayPal-Request-Id": requestId,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  if (!res.ok) {
    const issue = json?.details?.[0]?.issue ?? json?.message ?? "";
    throw new Error(
      `PayPal ${path.split("?")[0]} failed (${res.status}): ${json?.name ?? "error"} ${issue}`
        .trim()
        .slice(0, 300)
    );
  }
  return json;
}


export const paypalExecutor: Executor = async (a) => {
  const { rows } = await pool.query(
    `select paypal_dispute_id, tenant_id from disputes where id = $1`,
    [a.disputeId]
  );
  if (rows.length === 0) throw new Error("Dispute not found");
  const paypalId: string = rows[0].paypal_dispute_id;
  const tenantId: string = rows[0].tenant_id;

  
  if (paypalId.startsWith("DEMO-")) {
    return { simulated: true, note: "Demo dispute: no PayPal call was made" };
  }


  const resolved = await resolveCredentials(tenantId);
  if (!resolved) throw new Error("PayPal is not connected for this workspace");
  const creds = resolved.creds;

  switch (a.actionType) {
    case "UPLOAD_TRACKING": {
      const p = trackingSchema.parse(a.payload);

      const dispute = await getDispute(paypalId, creds);
      const txId = dispute?.disputed_transactions?.[0]?.seller_transaction_id;
      if (typeof txId !== "string") throw new Error("PayPal returned no transaction for this dispute");

      const out = await paypalPost(
        "/v1/shipping/trackers-batch",
        {
          trackers: [
            {
              transaction_id: txId,
              tracking_number: p.trackingNumber,
              status: "SHIPPED",
              carrier: "OTHER",
              carrier_name_other: p.carrier,
            },
          ],
        },
        a.id,
        creds
      );
      if (Array.isArray(out?.errors) && out.errors.length > 0) {
        throw new Error(`PayPal rejected the tracking: ${String(out.errors[0]?.name ?? "error")}`);
      }

   
      await pool.query(
        `insert into records (tenant_id, dispute_id, record_type, source, content)
         values ($1, $2, 'tracking', 'seller', $3)`,
        [
          tenantId,
          a.disputeId,
          `Tracking number ${p.trackingNumber}, carrier ${p.carrier}, provided by the seller.`,
        ]
      );
      return { simulated: false, paypal: "tracking added", trackingNumber: p.trackingNumber };
    }

    case "REFUND": {
      if (a.amountMinor === null || !a.currency) throw new Error("Refund needs an amount and currency");
      const p = offerSchema.parse(a.payload ?? {});
      await paypalPost(
        `/v1/customer/disputes/${encodeURIComponent(paypalId)}/make-offer`,
        {
          note: p.note,
          offer_amount: {
            currency_code: a.currency,
            value: fromMinor(a.amountMinor, a.currency),
          },
          offer_type: "REFUND",
        },
        a.id,
        creds
      );
      return { simulated: false, paypal: "refund offer sent", amountMinor: a.amountMinor };
    }

    case "RESPOND": {
      const p = messageSchema.parse(a.payload);
      await paypalPost(
        `/v1/customer/disputes/${encodeURIComponent(paypalId)}/send-message`,
        { message: p.message },
        a.id,
        creds
      );

    
      await pool.query(
        `insert into messages (tenant_id, dispute_id, sender_role, body)
         values ($1, $2, 'seller', $3)`,
        [tenantId, a.disputeId, p.message]
      );
      return { simulated: false, paypal: "message sent", length: p.message.length };
    }

    default:
      throw new Error("This action type is not supported yet");
  }
};