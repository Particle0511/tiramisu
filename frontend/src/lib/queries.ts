
import { api } from "./api";

import type {
  Alert,
  AuditEntry,
  Dispute,
  DisputeDetailData,
  Draft,
  Me,
  PaypalConnection,
  SettingsData,
  SyncResult,
} from "./types";

export const getMe = () => api<Me>("/me");

export const listDisputes = () =>
  api<{ disputes: Dispute[] }>("/disputes");

export const getDispute = (id: string) =>
  api<DisputeDetailData>(`/disputes/${id}`);

export const getRisks = () =>
  api<{ alerts: Alert[] }>("/risks");

export const getAudit = () =>
  api<{ entries: AuditEntry[] }>("/audit");

export const generateDraft = (id: string) =>
  api<{ draft: Draft }>(`/disputes/${id}/draft`, {
    method: "POST",
  });

export const createRespond = (id: string) =>
  api<{
    id: string;
    status: string;
    expiresAt: string;
    message: string;
  }>(`/disputes/${id}/respond`, {
    method: "POST",
  });

export const createAction = (body: {
  disputeId: string;
  actionType: "REFUND" | "UPLOAD_TRACKING" | "RESPOND";
  amountMinor?: number;
  currency?: string;
  payload?: Record<string, unknown>;
}) =>
  api<{ id: string; status: string; expiresAt: string }>("/actions", {
    method: "POST",
    body,
  });

export const approveAction = (id: string, password: string) =>
  api<{
    status: "executed" | "failed";
    result?: unknown;
    error?: string;
  }>(`/actions/${id}/approve`, {
    method: "POST",
    body: { password },
  });

export const rejectAction = (id: string) =>
  api<{ status: "rejected" }>(`/actions/${id}/reject`, {
    method: "POST",
  });

export const seedDemo = () =>
  api<{ ok: true }>("/demo/seed", {
    method: "POST",
  });

export const syncPaypal = () =>
  api<SyncResult>("/paypal/sync", {
    method: "POST",
  });

export const getSettings = () =>
  api<SettingsData>("/settings");

export const putSettings = (body: {
  maxRefundMinor: number;
  password: string;
}) =>
  api<SettingsData & { changed: boolean }>("/settings", {
    method: "PUT",
    body,
  });

export const verifyAudit = () =>
  api<{
    ok: boolean;
    checked: number;
    brokenAtSeq?: number;
  }>("/audit/verify");

export const getPaypalConnection = () =>
  api<PaypalConnection>("/paypal/connection");

export const putPaypalConnection = (body: {
  clientId: string;
  clientSecret: string;
  password: string;
}) =>
  api<PaypalConnection>("/paypal/connection", {
    method: "PUT",
    body,
  });

export const deletePaypalConnection = (password: string) =>
  api<PaypalConnection>("/paypal/connection", {
    method: "DELETE",
    body: { password },
  });
