import { env } from "../config/env";
import { getAccessToken } from "./client";

export type PayPalHeaders = {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
};

export async function verifyWebhookSignature(
  headers: PayPalHeaders,
  event: unknown
): Promise<boolean> {
  try {
    const token = await getAccessToken();

    const res = await fetch(
      `${env.PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auth_algo: headers.authAlgo,
          cert_url: headers.certUrl,
          transmission_id: headers.transmissionId,
          transmission_sig: headers.transmissionSig,
          transmission_time: headers.transmissionTime,
          webhook_id: env.PAYPAL_WEBHOOK_ID,
          webhook_event: event,
        }),
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!res.ok) {
      console.error(`Webhook verification call failed with status ${res.status}`);
      return false;
    }

    const data = (await res.json()) as { verification_status?: string };
    return data.verification_status === "SUCCESS";
  } catch (err) {
    console.error("Webhook verification error:", (err as Error).message);
    return false;
  }
}