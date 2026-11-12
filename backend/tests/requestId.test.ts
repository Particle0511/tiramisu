import { describe, it, expect } from "vitest";
import { resolveRequestId } from "../src/utils/requestId";

describe("resolveRequestId", () => {
  it("keeps a safe incoming ID", () => {
    expect(resolveRequestId("req-12345678")).toBe("req-12345678");
  });

  it("replaces an ID that is too short or too long", () => {
    expect(resolveRequestId("abc")).not.toBe("abc");
    const long = "a".repeat(65);
    expect(resolveRequestId(long)).not.toBe(long);
  });

  it("replaces an ID with unsafe characters (log injection)", () => {
    const evil = "abcd1234\nFAKE LOG LINE";
    expect(resolveRequestId(evil)).not.toBe(evil);
    expect(resolveRequestId("<script>alert(1)</script>")).not.toContain("<");
  });

  it("generates an ID when none is given", () => {
    expect(resolveRequestId(undefined)).toMatch(/^[0-9a-f-]{36}$/);
    expect(resolveRequestId(42)).toMatch(/^[0-9a-f-]{36}$/);
  });
});