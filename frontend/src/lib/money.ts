// PayPal treats these currencies as having no decimals
const ZERO_DECIMAL = new Set(["JPY", "HUF", "TWD"]);

export function currencyDigits(currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? 0 : 2;
}

// 8500 USD becomes "85.00"
export function fromMinorText(minor: number, currency: string): string {
  const digits = currencyDigits(currency);
  return (minor / 10 ** digits).toFixed(digits);
}

// "50.00" becomes 5000. Returns null when the text is not a valid amount.
export function toMinor(input: string, digits: number): number | null {
  const t = input.trim();
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  if (frac.length > digits) return null;
  const fracMinor = digits === 0 ? 0 : Number((frac + "0".repeat(digits)).slice(0, digits));
  return Number(whole) * 10 ** digits + fracMinor;
}