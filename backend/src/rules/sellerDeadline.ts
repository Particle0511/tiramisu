import { computeDeadline, type DeadlineInfo } from "./deadlines";


const NO_SELLER_DEADLINE = new Set([
  "WAITING_FOR_BUYER_RESPONSE",
  "UNDER_REVIEW",
  "RESOLVED",
]);

export function sellerResponseExpected(status?: string | null): boolean {
  return !status || !NO_SELLER_DEADLINE.has(status.toUpperCase());
}

export function computeSellerDeadline(
  input: { responseDueAt: Date | null; openedAt: Date | null; status?: string | null },
  now: Date = new Date()
): DeadlineInfo | null {
  if (!sellerResponseExpected(input.status)) return null;
  return computeDeadline(
    { responseDueAt: input.responseDueAt, openedAt: input.openedAt },
    now
  );
}