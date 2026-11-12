import { createHash } from "crypto";
import { env } from "../config/env";

export type PayPalCreds = { clientId: string; clientSecret: string };


export class PayPalAuthError extends Error {
  constructor() {
    super("PayPal rejected the credentials");
    this.name = "PayPalAuthError";
  }
}

type Cached = { value: string; expiresAt: number };
const cache = new Map<string, Cached>();
const MAX_CACHED = 100;


function cacheKey(c: PayPalCreds): string {
  return createHash("sha256").update(`${c.clientId}:${c.clientSecret}`).digest("hex");
}


export function envCredentials(): PayPalCreds {
  return { clientId: env.PAYPAL_CLIENT_ID, clientSecret: env.PAYPAL_CLIENT_SECRET };
}

export function forgetToken(c: PayPalCreds): void {
  cache.delete(cacheKey(c));
}

export async function getAccessToken(creds: PayPalCreds = envCredentials()): Promise<string> {
  const key = cacheKey(creds);
  const hit = cache.get(key);
  if (hit && Date.now() < hit.expiresAt - 60_000) return hit.value;

  const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");

  const res = await fetch(`${env.PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(10_000),
  });

  if (res.status === 400 || res.status === 401) throw new PayPalAuthError();
  if (!res.ok) {
    throw new Error(`PayPal token request failed with status ${res.status}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };

  if (cache.size >= MAX_CACHED) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 });
  return data.access_token;
}