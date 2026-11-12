import { describe, it, expect } from "vitest";
import { validateMaxRefund, MAX_REFUND_CEILING_MINOR } from "../src/rules/settings";

describe("validateMaxRefund", () => {
  it("accepts zero, which blocks all refunds", () => {
    expect(validateMaxRefund(0)).toEqual({ ok: true, value: 0 });
  });

  it("accepts a typical limit", () => {
    expect(validateMaxRefund(5000)).toEqual({ ok: true, value: 5000 });
  });

  it("accepts exactly the ceiling", () => {
    expect(validateMaxRefund(MAX_REFUND_CEILING_MINOR).ok).toBe(true);
  });

  it("rejects anything above the ceiling", () => {
    expect(validateMaxRefund(MAX_REFUND_CEILING_MINOR + 1).ok).toBe(false);
  });

  it("rejects negative amounts", () => {
    expect(validateMaxRefund(-1).ok).toBe(false);
  });

  it("rejects fractional amounts", () => {
    expect(validateMaxRefund(10.5).ok).toBe(false);
  });

  it("rejects things that are not numbers", () => {
    for (const bad of ["5000", null, undefined, NaN, Infinity, {}, [], true]) {
      expect(validateMaxRefund(bad).ok).toBe(false);
    }
  });
});