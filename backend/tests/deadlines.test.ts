import { describe, it, expect } from "vitest";
import { computeDeadline } from "../src/rules/deadlines";

const now = new Date("2026-11-09T12:00:00Z");
const inHours = (h: number) => new Date(now.getTime() + h * 3_600_000);

describe("computeDeadline", () => {
  it("returns null when there is no date at all", () => {
    expect(computeDeadline({ responseDueAt: null, openedAt: null }, now)).toBeNull();
  });

  it("uses PayPal's due date when present", () => {
    const d = computeDeadline({ responseDueAt: inHours(120), openedAt: null }, now)!;
    expect(d.source).toBe("paypal");
    expect(d.daysLeft).toBe(5);
    expect(d.status).toBe("ok");
  });

  it("falls back to opened date + 10 days and labels it estimated", () => {
    const d = computeDeadline({ responseDueAt: null, openedAt: now }, now)!;
    expect(d.source).toBe("estimated");
    expect(d.daysLeft).toBe(10);
  });

  it("is a warning under 3 days", () => {
    const d = computeDeadline({ responseDueAt: inHours(48), openedAt: null }, now)!;
    expect(d.status).toBe("warning");
  });

  it("is critical under 24 hours", () => {
    const d = computeDeadline({ responseDueAt: inHours(23), openedAt: null }, now)!;
    expect(d.status).toBe("critical");
    expect(d.hoursLeft).toBe(23);
  });

  it("is overdue after the deadline and never goes negative", () => {
    const d = computeDeadline({ responseDueAt: inHours(-5), openedAt: null }, now)!;
    expect(d.status).toBe("overdue");
    expect(d.daysLeft).toBe(0);
    expect(d.hoursLeft).toBe(0);
  });

  it("handles a dispute opened late in the day", () => {
    const opened = new Date("2026-11-09T23:59:00Z");
    const d = computeDeadline({ responseDueAt: null, openedAt: opened }, opened)!;
    expect(d.dueAt.toISOString()).toBe("2026-11-19T23:59:00.000Z");
  });

  it("ignores invalid dates", () => {
    const bad = new Date("not a date");
    expect(computeDeadline({ responseDueAt: bad, openedAt: bad }, now)).toBeNull();
  });
});