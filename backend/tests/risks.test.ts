import { describe, it, expect } from "vitest";
import { computeAlerts, type RiskInput } from "../src/rules/risks";

const base: RiskInput = {
  disputeId: "d1",
  paypalDisputeId: "PP-1",
  type: "ITEM_NOT_RECEIVED",
  deadlineStatus: "ok",
  hoursLeft: 240,
  daysLeft: 10,
  completenessPercent: 100,
  recordTypes: ["order", "payment", "tracking", "delivery_confirmation"],
  flaggedMessages: 0,
};

const codes = (i: RiskInput) => computeAlerts([i]).map((a) => a.code);

describe("computeAlerts", () => {
  it("raises nothing for a healthy dispute", () => {
    expect(codes(base)).toEqual([]);
  });

  it("proposes a tracking upload when tracking is missing", () => {
    const alerts = computeAlerts([{ ...base, recordTypes: ["order", "payment"] }]);
    const a = alerts.find((x) => x.code === "MISSING_TRACKING")!;
    expect(a.proposedAction?.actionType).toBe("UPLOAD_TRACKING");
    expect(a.proposedAction?.needs).toEqual(["trackingNumber", "carrier"]);
  });

  it("flags missing delivery proof only when tracking exists", () => {
    const c = codes({ ...base, recordTypes: ["order", "payment", "tracking"] });
    expect(c).toContain("NO_DELIVERY_PROOF");
    expect(c).not.toContain("MISSING_TRACKING");
  });

  it("does not ask for tracking on an unauthorized-payment dispute", () => {
    const c = codes({ ...base, type: "UNAUTHORIZED", recordTypes: ["order", "payment"] });
    expect(c).not.toContain("MISSING_TRACKING");
  });

  it("raises a critical alert when the deadline has passed", () => {
    const a = computeAlerts([{ ...base, deadlineStatus: "overdue", hoursLeft: 0, daysLeft: 0 }])[0];
    expect(a.code).toBe("DEADLINE_OVERDUE");
    expect(a.severity).toBe("critical");
  });

  it("raises a critical alert under 24 hours and states the hours", () => {
    const a = computeAlerts([{ ...base, deadlineStatus: "critical", hoursLeft: 5, daysLeft: 0 }])[0];
    expect(a.code).toBe("DEADLINE_CRITICAL");
    expect(a.detail).toContain("5 hours");
  });

  it("raises a warning when the deadline is within days", () => {
    const a = computeAlerts([{ ...base, deadlineStatus: "warning", hoursLeft: 50, daysLeft: 2 }])[0];
    expect(a.code).toBe("DEADLINE_SOON");
    expect(a.severity).toBe("warning");
  });

  it("flags thin evidence below 75% but not at 75%", () => {
    expect(codes({ ...base, completenessPercent: 50 })).toContain("LOW_EVIDENCE");
    expect(codes({ ...base, completenessPercent: 75 })).not.toContain("LOW_EVIDENCE");
  });

  it("flags hostile buyer messages", () => {
    const a = computeAlerts([{ ...base, flaggedMessages: 2 }])[0];
    expect(a.code).toBe("HOSTILE_MESSAGE");
    expect(a.title).toContain("2");
  });

  it("gives no deadline alert when there is no deadline", () => {
    expect(codes({ ...base, deadlineStatus: null, hoursLeft: null, daysLeft: null })).toEqual([]);
  });

  it("sorts critical first, then warnings, then info", () => {
    const alerts = computeAlerts([
      { ...base, disputeId: "c", recordTypes: ["order", "payment", "tracking"] },
      { ...base, disputeId: "b", recordTypes: ["order", "payment"], completenessPercent: 50 },
      { ...base, disputeId: "a", deadlineStatus: "overdue", hoursLeft: 0, daysLeft: 0 },
    ]);
    expect(alerts.map((x) => x.severity)).toEqual(["critical", "warning", "warning", "info"]);
  });
});