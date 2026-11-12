import { describe, it, expect } from "vitest";
import { buildResponseMessage } from "../src/ai/message";

const draft = (texts: string[]) => ({
  statements: texts.map((t) => ({ text: t, sourceRecordIds: ["x"] })),
});

describe("buildResponseMessage", () => {
  it("joins the supported statements in order", () => {
    expect(buildResponseMessage(draft(["First.", "Second."]))).toBe("First. Second.");
  });

  it("returns null when there is nothing to send", () => {
    expect(buildResponseMessage(draft([]))).toBeNull();
    expect(buildResponseMessage(null)).toBeNull();
    expect(buildResponseMessage({ statements: "no" })).toBeNull();
  });

  it("skips empty and malformed statements", () => {
    const d = { statements: [{ text: "  " }, null, { text: 5 }, { text: "Kept." }] };
    expect(buildResponseMessage(d)).toBe("Kept.");
  });

  it("never exceeds 2000 characters and cuts at a whole statement", () => {
    const long = "a".repeat(900);
    const msg = buildResponseMessage(draft([long, long, long]))!;
    expect(msg.length).toBeLessThanOrEqual(2000);
    expect(msg).toBe(`${long} ${long}`);
  });

  it("ignores the dropped list, so only supported text can be sent", () => {
    const d = { statements: [{ text: "Supported." }], dropped: [{ text: "Invented claim." }] };
    expect(buildResponseMessage(d)).toBe("Supported.");
  });
});