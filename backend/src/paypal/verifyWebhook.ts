import { env } from "../config/env";
import { logger } from "../utils/logger";
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
  rawBody: string
): Promise<boolean> {
  try {
    const token = await getAccessToken();

    const requestBody =
      `{"auth_algo":${JSON.stringify(headers.authAlgo)}` +
      `,"cert_url":${JSON.stringify(headers.certUrl)}` +
      `,"transmission_id":${JSON.stringify(headers.transmissionId)}` +
      `,"transmission_sig":${JSON.stringify(headers.transmissionSig)}` +
      `,"transmission_time":${JSON.stringify(headers.transmissionTime)}` +
      `,"webhook_id":${JSON.stringify(env.PAYPAL_WEBHOOK_ID)}` +
      `,"webhook_event":${rawBody}}`;

    const res = await fetch(
      `${env.PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: requestBody,
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!res.ok) {
      logger.warn({ status: res.status }, "webhook verification call failed");
      return false;
    }

    const data = (await res.json()) as { verification_status?: string };
    return data.verification_status === "SUCCESS";
  } catch (err) {
    logger.warn({ err }, "webhook verification error");
    return false;
  }
}