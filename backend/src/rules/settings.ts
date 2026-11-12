export const DEFAULT_MAX_REFUND_MINOR = 5000;

export const MAX_REFUND_CEILING_MINOR = 1_000_000;

export type MaxRefundCheck = { ok: true; value: number } | { ok: false; reason: string };

export function validateMaxRefund(input: unknown): MaxRefundCheck {
  if (typeof input !== "number" || !Number.isInteger(input)) {
    return { ok: false, reason: "The limit must be a whole number of minor units" };
  }
  if (input < 0) {
    return { ok: false, reason: "The limit cannot be negative" };
  }
  if (input > MAX_REFUND_CEILING_MINOR) {
    return { ok: false, reason: "The limit is above the allowed maximum" };
  }
  return { ok: true, value: input };
}