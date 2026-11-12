import type { Deadline } from "./format";

export type Tone = "ok" | "warn" | "crit" | "neutral";

export function sentence(s: string): string {
  const x = s.replace(/_/g, " ").toLowerCase();
  return x.charAt(0).toUpperCase() + x.slice(1);
}
export const statusLabel = sentence;

const TYPES: Record<string, string> = {
  ITEM_NOT_RECEIVED: "Item not received",
  ITEM_NOT_AS_DESCRIBED: "Item not as described",
  UNAUTHORIZED: "Unauthorized purchase",
  OTHER: "Other",
};
export function typeLabel(t: string | null): string {
  if (!t) return "Unknown type";
  return TYPES[t] ?? sentence(t);
}

const RECORDS: Record<string, string> = {
  order: "Order details",
  payment: "Payment record",
  tracking: "Tracking information",
  delivery_confirmation: "Delivery confirmation",
  shipping_receipt: "Shipping receipt",
  refund_proof: "Refund proof",
  shipping_address: "Shipping address",
  buyer_message: "Buyer message",
  listing: "Item listing",
  photos: "Photos",
  refund_policy: "Refund policy",
};
export function recordLabel(t: string): string {
  return RECORDS[t] ?? sentence(t);
}

export function isOpen(status: string): boolean {
  return status.toUpperCase() !== "RESOLVED";
}

export function deadlineTone(d: Deadline | null): Tone {
  if (!d) return "neutral";
  if (d.status === "overdue" || d.status === "critical") return "crit";
  if (d.status === "warning") return "warn";
  return "ok";
}

export function urgency(d: Deadline | null): { label: string; tone: Tone } {
  const tone = deadlineTone(d);
  return {
    label: tone === "crit" ? "Urgent" : tone === "warn" ? "Review" : "Monitoring",
    tone: tone === "ok" ? "neutral" : tone,
  };
}

export function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const ACTIVITY: Record<string, string> = {
  "draft.generated": "AI draft generated",
  "action.created": "Action prepared for approval",
  "action.approved": "You approved an action",
  "action.executed": "Action sent to PayPal",
  "action.failed": "An action failed",
  "action.rejected": "You rejected an action",
  "action.blocked": "An action was blocked by your limits",
  "action.expired": "An action expired",
  "settings.updated": "Refund limit changed",
  "demo.seeded": "Demo disputes loaded",
  "tenant.created": "Workspace created",
  "stepup.failed": "Password check failed",
};
export function activityText(code: string): string {
  return ACTIVITY[code] ?? sentence(code.replace(/\./g, " "));
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}