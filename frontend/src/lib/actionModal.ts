import { formatMoney } from "./format";
import type { ModalAction } from "../components/ApprovalModal";
import type { PendingAction } from "./types";

export function actionTitle(type: string): string {
  if (type === "RESPOND") return "Send response to buyer via PayPal";
  if (type === "UPLOAD_TRACKING") return "Upload tracking to PayPal";
  if (type === "REFUND") return "Offer a refund via PayPal";
  return type;
}

export function modalFromPending(a: PendingAction): ModalAction {
  const p = (a.payload ?? {}) as Record<string, unknown>;
  const lines: [string, string][] = [];
  if (a.amount_minor !== null) lines.push(["Amount", formatMoney(a.amount_minor, a.currency)]);
  if (typeof p.trackingNumber === "string") lines.push(["Tracking number", p.trackingNumber]);
  if (typeof p.carrier === "string") lines.push(["Carrier", p.carrier]);
  return {
    id: a.id,
    title: actionTitle(a.action_type),
    lines,
    // A response is sent as "message". A refund offer is sent as "note". Both are shown in full.
    message:
      typeof p.message === "string" ? p.message : typeof p.note === "string" ? p.note : undefined,
    expiresAt: a.expires_at,
  };
}