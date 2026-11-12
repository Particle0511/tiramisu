const ZERO_DECIMAL = new Set(["JPY", "HUF", "TWD"]);


export function toMinor(value: string, currency: string): number {
  const decimals = ZERO_DECIMAL.has(currency) ? 0 : 2;
  const [whole, frac = ""] = value.split(".");
  const fracPart = frac.padEnd(decimals, "0").slice(0, decimals);
  return Number(whole) * 10 ** decimals + (decimals ? Number(fracPart) : 0);
}

export function mapType(reason?: string): string {
  switch (reason) {
    case "ITEM_NOT_RECEIVED":
    case "MERCHANDISE_OR_SERVICE_NOT_RECEIVED":
      return "ITEM_NOT_RECEIVED";
    case "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED":
      return "ITEM_NOT_AS_DESCRIBED";
    case "UNAUTHORISED":
      return "UNAUTHORIZED";
    default:
      return "OTHER";
  }
}