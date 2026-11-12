import { env } from "../config/env";
import { pool } from "../db/client";
import { decryptSecret } from "../crypto/secrets";
import { vaultKey } from "../crypto/vault";
import { envCredentials, type PayPalCreds } from "./client";

export type ResolvedCreds = { creds: PayPalCreds; source: "tenant" | "env" };


export async function loadTenantCredentials(tenantId: string): Promise<PayPalCreds | null> {
  const { rows } = await pool.query(
    "select client_id, secret_encrypted from paypal_connections where tenant_id = $1",
    [tenantId]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    clientId: row.client_id as string,
    clientSecret: decryptSecret(row.secret_encrypted as string, tenantId, vaultKey()),
  };
}


export async function isOwnerWorkspace(tenantId: string): Promise<boolean> {
  const emails = [...env.PAYPAL_SYNC_ALLOWED_EMAILS.split(","), env.WEBHOOK_TENANT_EMAIL]
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  for (const email of new Set(emails)) {
    const r = await pool.query("select app_tenant_by_email($1) as id", [email]);
    if (r.rows[0]?.id === tenantId) return true;
  }
  return false;
}


export async function resolveCredentials(tenantId: string): Promise<ResolvedCreds | null> {
  const own = await loadTenantCredentials(tenantId);
  if (own) return { creds: own, source: "tenant" };
  if (await isOwnerWorkspace(tenantId)) return { creds: envCredentials(), source: "env" };
  return null;
}