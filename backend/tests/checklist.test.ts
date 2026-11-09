import { describe, it, expect } from "vitest";
import { buildChecklist } from "../src/rules/disputeTypes";

describe("buildChecklist", () => {
  it("scores 0% with no records and lists everything required as missing", () => {
    const c = buildChecklist("ITEM_NOT_RECEIVED", []);
    expect(c.completenessPercent).toBe(0);
    expect(c.missingRequired).toContain("Shipment tracking number");
  });

  it("scores 100% when all required items are found", () => {
    const c = buildChecklist("ITEM_NOT_RECEIVED", [
      "order",
      "payment",
      "tracking",
      "delivery_confirmation",
    ]);
    expect(c.completenessPercent).toBe(100);
    expect(c.missingRequired).toEqual([]);
  });

  it("does not count optional items toward the score", () => {
    const c = buildChecklist("ITEM_NOT_RECEIVED", ["buyer_message", "shipping_address"]);
    expect(c.completenessPercent).toBe(0);
  });

  it("ignores unknown record types", () => {
    const c = buildChecklist("OTHER", ["something_made_up"]);
    expect(c.completenessPercent).toBe(0);
  });

  it("scores partially", () => {
    const c = buildChecklist("ITEM_NOT_RECEIVED", ["order", "payment"]);
    expect(c.completenessPercent).toBe(50);
  });
});