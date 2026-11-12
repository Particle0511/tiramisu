// PayPal retries a failed delivery for about 3 days, so allow 4
export const MAX_AGE_MS = 4 * 24 * 60 * 60 * 1000;
export const MAX_FUTURE_MS = 5 * 60 * 1000;


export function isPayPalCertUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      (host === "paypal.com" || host.endsWith(".paypal.com"))
    );
  } catch {
    return false;
  }
}

export function checkTransmissionTime(
  value: string,
  now: Date = new Date()
): { ok: true } | { ok: false; reason: string } {
  const t = Date.parse(value);
  if (Number.isNaN(t)) return { ok: false, reason: "Invalid transmission time" };
  const age = now.getTime() - t;
  if (age > MAX_AGE_MS) return { ok: false, reason: "Transmission time is too old" };
  if (age < -MAX_FUTURE_MS) return { ok: false, reason: "Transmission time is in the future" };
  return { ok: true };
}