import type { DeadlineStatus } from "./deadlines";

export type Severity = "critical" | "warning" | "info";

export type Alert = {
  id: string;
  code:
    | "DEADLINE_OVERDUE"
    | "DEADLINE_CRITICAL"
    | "DEADLINE_SOON"
    | "MISSING_TRACKING"
    | "NO_DELIVERY_PROOF"
    | "LOW_EVIDENCE"
    | "HOSTILE_MESSAGE";
  severity: Severity;
  disputeId: string;
  paypalDisputeId: string;
  title: string;
  detail: string;
  proposedAction?: { actionType: "UPLOAD_TRACKING"; needs: string[] };
};

export type RiskInput = {
  disputeId: string;
  paypalDisputeId: string;
  type: string;
  deadlineStatus: DeadlineStatus | null;
  hoursLeft: number | null;
  daysLeft: number | null;
  completenessPercent: number;
  recordTypes: string[];
  flaggedMessages: number;
};

const RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

export function computeAlerts(inputs: RiskInput[]): Alert[] {
  const out: { alert: Alert; hours: number }[] = [];

  for (const d of inputs) {
    const hours = d.hoursLeft ?? Number.POSITIVE_INFINITY;
    const add = (
      code: Alert["code"],
      severity: Severity,
      title: string,
      detail: string,
      proposedAction?: Alert["proposedAction"]
    ) =>
      out.push({
        hours,
        alert: {
          id: `${code}:${d.disputeId}`,
          code,
          severity,
          disputeId: d.disputeId,
          paypalDisputeId: d.paypalDisputeId,
          title,
          detail,
          proposedAction,
        },
      });

    if (d.deadlineStatus === "overdue") {
      add("DEADLINE_OVERDUE", "critical", "Response deadline has passed", "The time to respond to this dispute is over.");
    } else if (d.deadlineStatus === "critical") {
      add("DEADLINE_CRITICAL", "critical", "Less than 24 hours left", `${d.hoursLeft ?? 0} hours left to respond.`);
    } else if (d.deadlineStatus === "warning") {
      add("DEADLINE_SOON", "warning", "Deadline is close", `${d.daysLeft ?? 0} days left to respond.`);
    }

    const hasTracking = d.recordTypes.includes("tracking");
    const hasDelivery = d.recordTypes.includes("delivery_confirmation");

    if (d.type === "ITEM_NOT_RECEIVED" && !hasTracking) {
      add(
        "MISSING_TRACKING",
        "warning",
        "No tracking number on file",
        "Proof of shipment is the first thing an item-not-received dispute needs. Add the tracking number if you have one.",
        { actionType: "UPLOAD_TRACKING", needs: ["trackingNumber", "carrier"] }
      );
    }

    if (d.type === "ITEM_NOT_RECEIVED" && hasTracking && !hasDelivery) {
      add(
        "NO_DELIVERY_PROOF",
        "info",
        "No delivery confirmation yet",
        "Check the carrier for a delivery or signature confirmation."
      );
    }

    if (d.completenessPercent < 75) {
      add(
        "LOW_EVIDENCE",
        "warning",
        "Evidence is thin",
        `Only ${d.completenessPercent}% of the required evidence was found.`
      );
    }

    if (d.flaggedMessages > 0) {
      add(
        "HOSTILE_MESSAGE",
        "warning",
        `${d.flaggedMessages} buyer message(s) flagged`,
        "They try to give instructions to the assistant. They were kept away from the AI and nothing was done because of them."
      );
    }
  }

  out.sort((a, b) => RANK[a.alert.severity] - RANK[b.alert.severity] || a.hours - b.hours);
  return out.map((x) => x.alert);
}