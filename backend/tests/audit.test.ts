import { describe, it, expect } from "vitest";
import { computeHash } from "../src/audit/hash";

const f = {
  tenantId: "t1",
  seq: 1,
  actor: "alice",
  action: "action.approved",
  targetType: "pending_action",
  targetId: "a1",
  details: { amountMinor: 3000, currency: "USD" },
  prevHash: "GENESIS",
  createdAt: "2026-11-09T12:00:00.000Z",
};

describe("computeHash", () => {
  it("is the same for the same input", () => {
    expect(computeHash(f)).toBe(computeHash({ ...f }));
  });

  it("does not depend on the key order inside details", () => {
    const a = computeHash({ ...f, details: { amountMinor: 3000, currency: "USD" } });
    const b = computeHash({ ...f, details: { currency: "USD", amountMinor: 3000 } });
    expect(a).toBe(b);
  });

  it("changes if the actor is changed", () => {
    expect(computeHash({ ...f, actor: "mallory" })).not.toBe(computeHash(f));
  });

  it("changes if the details are changed", () => {
    const edited = { ...f, details: { amountMinor: 9999, currency: "USD" } };
    expect(computeHash(edited)).not.toBe(computeHash(f));
  });

  it("changes if the previous hash is changed", () => {
    expect(computeHash({ ...f, prevHash: "other" })).not.toBe(computeHash(f));
  });
});