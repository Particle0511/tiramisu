const ZERO_DECIMAL = new Set(["JPY", "HUF", "TWD"]);


export function fromMinor(minor: number, currency: string): string {
  if (!Number.isInteger(minor) || minor < 0) {
    throw new Error("Amount must be a non-negative whole number of minor units");
  }
  if (ZERO_DECIMAL.has(currency.toUpperCase())) return String(minor);
  const whole = Math.floor(minor / 100);
  const frac = String(minor % 100).padStart(2, "0");
  return `${whole}.${frac}`;
}