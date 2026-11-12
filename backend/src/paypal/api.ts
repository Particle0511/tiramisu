import { env } from "../config/env";
import { getAccessToken, envCredentials, type PayPalCreds } from "./client";

async function paypalGet(path: string, creds: PayPalCreds): Promise<any | null> {
  const token = await getAccessToken(creds);
  const res = await fetch(`${env.PAYPAL_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`PayPal GET ${path.split("?")[0]} failed with status ${res.status}`);
  }
  return res.json();
}

export async function listDisputes(creds: PayPalCreds = envCredentials()): Promise<any[]> {
  const data = await paypalGet("/v1/customer/disputes?page_size=20", creds);
  return Array.isArray(data?.items) ? data.items : [];
}

export const getDispute = (id: string, creds: PayPalCreds = envCredentials()) =>
  paypalGet(`/v1/customer/disputes/${encodeURIComponent(id)}`, creds);

export const getCapture = (id: string, creds: PayPalCreds = envCredentials()) =>
  paypalGet(`/v2/payments/captures/${encodeURIComponent(id)}`, creds);

export const getOrder = (id: string, creds: PayPalCreds = envCredentials()) =>
  paypalGet(`/v2/checkout/orders/${encodeURIComponent(id)}`, creds);