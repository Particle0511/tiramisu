import { describe, it, expect } from "vitest";
import { checkLimits, canTransition } from "../src/actions/limits";

const now = new Date("2026-11-09T12:00:00Z");
const later = new Date("2026-11-10T12:00:00Z");

const base = {
  actionType: "REFUND",
  amountMinor: 3000,
  currency: "USD",
  maxRefundMinor: 5000,
  disputeAmountMinor: 8500,
  disputeCurrency: "USD",
  expiresAt: later,
};

describe("checkLimits", () => {
  it("allows a refund inside every limit", () => {
    expect(checkLimits(base, now).ok).toBe(true);
  });

  it("blocks a refund above the seller's maximum", () => {
    const r = checkLimits({ ...base, amountMinor: 6000 }, now);
    expect(r.ok).toBe(false);
  });

  it("blocks a refund larger than the disputed amount", () => {
    const r = checkLimits({ ...base, amountMinor: 9000, maxRefundMinor: 99999 }, now);
    expect(r.ok).toBe(false);
  });

  it("blocks a currency mismatch", () => {
    expect(checkLimits({ ...base, currency: "EUR" }, now).ok).toBe(false);
  });

  it("blocks an expired action and says it expired", () => {
    const r = checkLimits({ ...base, expiresAt: new Date("2026-11-09T11:00:00Z") }, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.expired).toBe(true);
  });

  it("blocks a refund with no amount", () => {
    expect(checkLimits({ ...base, amountMinor: null }, now).ok).toBe(false);
  });

  it("does not apply refund limits to other action types", () => {
    const r = checkLimits({ ...base, actionType: "UPLOAD_TRACKING", amountMinor: null, currency: null }, now);
    expect(r.ok).toBe(true);
  });
});

describe("canTransition", () => {
  it("allows the normal path", () => {
    expect(canTransition("pending", "approved")).toBe(true);
    expect(canTransition("approved", "executed")).toBe(true);
  });

  it("never lets a finished action run again", () => {
    expect(canTransition("executed", "approved")).toBe(false);
    expect(canTransition("rejected", "approved")).toBe(false);
    expect(canTransition("failed", "approved")).toBe(false);
  });

  it("does not allow skipping approval or going backwards", () => {
    expect(canTransition("pending", "executed")).toBe(false);
    expect(canTransition("approved", "pending")).toBe(false);
  });
});