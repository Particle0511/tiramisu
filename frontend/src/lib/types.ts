import type { Deadline } from "./format";

export type ChecklistItem = { key: string; label: string; required: boolean; recordType: string; found: boolean };
export type Checklist = { items: ChecklistItem[]; completenessPercent: number; missingRequired: string[] };

export type Dispute = {
  id: string;
  paypalDisputeId: string;
  type: string | null;
  reason: string | null;
  status: string;
  amountMinor: number | null;
  currency: string | null;
  openedAt: string | null;
  responseDueAt: string | null;
  deadline: Deadline | null;
  rulesLastChecked: string;
  evidenceCompletenessPercent: number;
  missingRequired: string[];
  checklist: Checklist;
  aiStatus: string;
  generationsLeft: number;
};

export type RecordRow = { id: string; record_type: string; source: string | null; content: string };
export type MessageRow = {
  id: string;
  sender_role: string;
  body: string;
  injection_flag: boolean | null;
  flag_reason: string | null;
  created_at: string;
};
export type CostOption = {
  key: string;
  label: string;
  available: boolean;
  bestCaseLossMinor: number;
  worstCaseLossMinor: number;
  note: string;
};
export type CostComparison = {
  currency: string;
  options: CostOption[];
  evidenceCompletenessPercent: number;
  assumptions: string[];
};
export type Draft = {
  statements: { text: string; sourceRecordIds: string[] }[];
  dropped: unknown[];
  flaggedMessages: { id: string; reasons: string[] }[];
  model: string;
  generatedAt: string;
};
export type PendingAction = {
  id: string;
  action_type: string;
  amount_minor: number | null;
  currency: string | null;
  status: string;
  expires_at: string;
  created_at: string;
  created_by: string;
  decided_by: string | null;
  payload: Record<string, unknown> | null;
};
export type DisputeDetailData = {
  dispute: Dispute;
  records: RecordRow[];
  messages: MessageRow[];
  options: CostComparison | null;
  draft: Draft | null;
  actions: PendingAction[];
};
export type Me = { email: string | null; role: "owner" | "viewer"; tenantId: string; rulesLastChecked: string };
export type AuditEntry = {
  seq: number;
  actor: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  hash: string;
  created_at: string;
};
export type Alert = {
  id: string;
  code: string;
  severity: "critical" | "warning" | "info";
  disputeId: string;
  paypalDisputeId: string;
  title: string;
  detail: string;
  proposedAction?: { actionType: "UPLOAD_TRACKING"; needs: string[] };
};
export type SettingsData = {
  maxRefundMinor: number;
  maxRefundFormatted: string;
  currency: string;
  ceilingMinor: number;
  ceilingFormatted: string;
};
export type PaypalConnection = {
  environment: "sandbox";
  canConnect: boolean;
  connected: boolean;
  source: "tenant" | "env" | "none";
  status: "connected" | "invalid" | "not_connected";
  clientIdMasked: string | null;
  lastVerifiedAt: string | null;
  lastSyncAt: string | null;
};
export type SyncResult = { fetched: number; imported: number; skippedOtherAccount: number; imports: unknown[] };