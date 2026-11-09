export type ActionStatus =
  | "pending" | "approved" | "rejected" | "expired" | "executed" | "failed";

const TRANSITIONS: Record<ActionStatus, ActionStatus[]> = {
  pending: ["approved", "rejected", "expired"],
  approved: ["executed", "failed"],
  rejected: [],
  expired: [],
  executed: [],
  failed: [],
};

export function canTransition(from: ActionStatus, to: ActionStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export type LimitInput = {
  actionType: string;
  amountMinor: number | null;
  currency: string | null;
  maxRefundMinor: number;
  disputeAmountMinor: number | null;
  disputeCurrency: string | null;
  expiresAt: Date;
};

export type LimitResult =
  | { ok: true }
  | { ok: false; reason: string; expired: boolean };

export function checkLimits(i: LimitInput, now: Date = new Date()): LimitResult {
  const fail = (reason: string, expired = false): LimitResult => ({
    ok: false,
    reason,
    expired,
  });

  if (now.getTime() >= i.expiresAt.getTime()) return fail("Action has expired", true);

  if (i.actionType === "REFUND") {
    if (i.amountMinor === null || !Number.isInteger(i.amountMinor) || i.amountMinor <= 0) {
      return fail("Refund needs a positive whole amount");
    }
    if (!i.currency || i.currency !== i.disputeCurrency) {
      return fail("Refund currency does not match the dispute currency");
    }
    if (i.disputeAmountMinor !== null && i.amountMinor > i.disputeAmountMinor) {
      return fail("Refund is larger than the disputed amount");
    }
    if (i.amountMinor > i.maxRefundMinor) {
      return fail("Refund is above your maximum refund limit");
    }
  }
  return { ok: true };
}