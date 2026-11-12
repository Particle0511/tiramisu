import { describe, it, expect } from "vitest";
import { linkStatements, extractDates, type EvidenceRecord } from "../src/evidence/linker";

const records: EvidenceRecord[] = [
  { id: "r1", type: "order", content: "Order created 2026-11-09T11:21:31Z for a tote bag." },
  { id: "r2", type: "payment", content: "Payment completed on 2026-10-30." },
];

const link = (text: string, ids: string[] = ["r1"]) =>
  linkStatements([{ text, sourceRecordIds: ids }], records);

describe("dates written in words", () => {
  it("keeps a date that matches the cited record", () => {
    expect(link("You placed the order on 9 November 2026.").supported).toHaveLength(1);
  });

  it("drops a date that does not match", () => {
    const r = link("You placed the order on 10 November 2026.");
    expect(r.supported).toHaveLength(0);
    expect(r.dropped[0].reason).toMatch(/not in the cited records/);
  });

  it("understands other ways of writing the same date", () => {
    expect(link("The order was placed on November 9, 2026.").supported).toHaveLength(1);
    expect(link("The order was placed on 9th Nov 2026.").supported).toHaveLength(1);
  });

  it("checks the date against the cited record, not any record", () => {

    expect(link("Payment arrived on 30 October 2026.", ["r1"]).supported).toHaveLength(0);
    expect(link("Payment arrived on 30 October 2026.", ["r2"]).supported).toHaveLength(1);
  });

  it("drops an impossible date", () => {
    const r = link("You ordered on 31 February 2026.");
    expect(r.supported).toHaveLength(0);
    expect(r.dropped[0].reason).toMatch(/not a valid date/);
  });

  it("leaves statements without dates alone", () => {
    expect(link("The order was for a tote bag.").supported).toHaveLength(1);
  });

  it("extracts dates from text", () => {
    expect(extractDates("On 9 November 2026 and November 12, 2026").map((d) => d.iso)).toEqual([
      "2026-11-09",
      "2026-11-12",
    ]);
  });
});