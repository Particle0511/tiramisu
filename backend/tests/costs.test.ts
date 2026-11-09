import { describe, it, expect } from "vitest";
import { compareOptions } from "../src/rules/costs";

const base = {
  amountMinor: 8500,
  currency: "USD",
  deadlineStatus: "ok" as const,
  evidenceCompletenessPercent: 50,
};

const get = (r: ReturnType<typeof compareOptions>, key: string) =>
  r.options.find((o) => o.key === key)!;

describe("compareOptions", () => {
  it("full refund and accept lose the full amount", () => {
    const r = compareOptions(base);
    expect(get(r, "refund_full").worstCaseLossMinor).toBe(8500);
    expect(get(r, "accept").worstCaseLossMinor).toBe(8500);
  });

  it("includes goods cost and dispute fee when given", () => {
    const r = compareOptions({ ...base, goodsCostMinor: 3000, disputeFeeMinor: 1500 });
    expect(get(r, "refund_full").worstCaseLossMinor).toBe(11500);
    expect(get(r, "accept").worstCaseLossMinor).toBe(13000);
  });

  it("contest: best case is zero, worst case equals accepting", () => {
    const r = compareOptions({ ...base, disputeFeeMinor: 1500 });
    const c = get(r, "contest");
    expect(c.bestCaseLossMinor).toBe(0);
    expect(c.worstCaseLossMinor).toBe(get(r, "accept").worstCaseLossMinor);
    expect(c.available).toBe(true);
  });

  it("contest is unavailable when the deadline has passed", () => {
    const r = compareOptions({ ...base, deadlineStatus: "overdue" });
    expect(get(r, "contest").available).toBe(false);
  });

  it("adds a partial refund option only when it is valid", () => {
    const withPartial = compareOptions({ ...base, partialRefundMinor: 2000 });
    expect(get(withPartial, "refund_partial").bestCaseLossMinor).toBe(2000);
    expect(compareOptions(base).options.some((o) => o.key === "refund_partial")).toBe(false);
  });

  it("rejects bad input", () => {
    expect(() => compareOptions({ ...base, amountMinor: -1 })).toThrow();
    expect(() => compareOptions({ ...base, amountMinor: 10.5 })).toThrow();
    expect(() => compareOptions({ ...base, partialRefundMinor: 9999 })).toThrow();
  });

  it("passes evidence completeness through and states its assumptions", () => {
    const r = compareOptions(base);
    expect(r.evidenceCompletenessPercent).toBe(50);
    expect(r.assumptions.length).toBeGreaterThan(0);
  });
});