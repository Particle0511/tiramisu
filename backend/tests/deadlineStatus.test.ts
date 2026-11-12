import { describe, it, expect } from "vitest";
import { computeSellerDeadline, sellerResponseExpected } from "../src/rules/sellerDeadline";

const now = new Date("2026-11-10T12:00:00Z");
const due = new Date("2026-11-15T12:00:00Z");

describe("computeSellerDeadline", () => {
  it("has no deadline while waiting for the buyer, even with a due date", () => {
    const d = computeSellerDeadline(
      { responseDueAt: due, openedAt: now, status: "WAITING_FOR_BUYER_RESPONSE" },
      now
    );
    expect(d).toBeNull();
  });

  it("has no deadline once resolved or under review", () => {
    expect(computeSellerDeadline({ responseDueAt: due, openedAt: now, status: "RESOLVED" }, now)).toBeNull();
    expect(computeSellerDeadline({ responseDueAt: due, openedAt: now, status: "UNDER_REVIEW" }, now)).toBeNull();
  });

  it("still counts down while waiting for the seller", () => {
    const d = computeSellerDeadline(
      { responseDueAt: due, openedAt: now, status: "WAITING_FOR_SELLER_RESPONSE" },
      now
    );
    expect(d?.daysLeft).toBe(5);
  });

  it("still counts down for open or missing status", () => {
    expect(computeSellerDeadline({ responseDueAt: due, openedAt: now, status: "OPEN" }, now)?.daysLeft).toBe(5);
    expect(computeSellerDeadline({ responseDueAt: due, openedAt: now }, now)?.daysLeft).toBe(5);
  });

  it("ignores the case of the status", () => {
    expect(sellerResponseExpected("waiting_for_buyer_response")).toBe(false);
    expect(sellerResponseExpected("Waiting_For_Seller_Response")).toBe(true);
  });
});