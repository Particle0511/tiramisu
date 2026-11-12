import { describe, it, expect } from "vitest";
import { fromMinor } from "../src/rules/money";

describe("fromMinor", () => {
  it("formats whole units and cents", () => {
    expect(fromMinor(8500, "USD")).toBe("85.00");
    expect(fromMinor(12345, "USD")).toBe("123.45");
  });

  it("pads small cent values", () => {
    expect(fromMinor(5, "USD")).toBe("0.05");
    expect(fromMinor(100, "usd")).toBe("1.00");
  });

  it("handles currencies without decimals", () => {
    expect(fromMinor(500, "JPY")).toBe("500");
  });

  it("rejects fractional and negative amounts", () => {
    expect(() => fromMinor(10.5, "USD")).toThrow();
    expect(() => fromMinor(-1, "USD")).toThrow();
  });
});