import { describe, it, expect } from "vitest";
import { toMinor, mapType } from "../src/disputes/mapping";

describe("toMinor", () => {
  it("converts decimals to whole minor units", () => {
    expect(toMinor("85.00", "USD")).toBe(8500);
    expect(toMinor("85", "USD")).toBe(8500);
    expect(toMinor("0.5", "USD")).toBe(50);
  });

  it("handles currencies without decimals", () => {
    expect(toMinor("500", "JPY")).toBe(500);
  });
});

describe("mapType", () => {
  it("maps PayPal's real item-not-received reason", () => {
    expect(mapType("MERCHANDISE_OR_SERVICE_NOT_RECEIVED")).toBe("ITEM_NOT_RECEIVED");
  });

  it("maps the unauthorized spelling PayPal uses", () => {
    expect(mapType("UNAUTHORISED")).toBe("UNAUTHORIZED");
  });

  it("falls back to OTHER for anything unknown", () => {
    expect(mapType("SOMETHING_NEW")).toBe("OTHER");
    expect(mapType(undefined)).toBe("OTHER");
  });
});