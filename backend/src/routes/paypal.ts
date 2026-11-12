import { Router } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../config/env";
import { pool } from "../db/client";
import { withTx } from "../db/tx";
import { requireOwner } from "../middleware/auth";
import { appendAudit } from "../audit/log";
import { verifyPassword } from "../auth/stepUp";
import { encryptSecret } from "../crypto/secrets";
import { encryptionConfigured, vaultKey } from "../crypto/vault";
import { getAccessToken, forgetToken, PayPalAuthError } from "../paypal/client";
import { connectionInput, passwordOnly, maskClientId } from "../paypal/connectionInput";
import { isOwnerWorkspace, loadTenantCredentials, resolveCredentials } from "../paypal/credentials";
import { syncFromPayPal } from "../paypal/sync";

export const paypalRouter = Router();

const limiter = rateLimit({
  windowMs: 60_000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, wait a minute" },
});

function sandboxOnly(): boolean {
  try {
    return new URL(env.PAYPAL_BASE_URL).hostname.endsWith("sandbox.paypal.com");
  } catch {
    return false;
  }
}


async function statusFor(tenantId: string) {
  const { rows } = await pool.query(
    "select client_id, status, last_verified_at, last_sync_at from paypal_connections where tenant_id = $1",
    [tenantId]
  );
  const base = {
    environment: "sandbox" as const,
    canConnect: encryptionConfigured() && sandboxOnly(),
  };
  const row = rows[0];
  if (row) {
    return {
      ...base,
      connected: true,
      source: "tenant" as const,
      status: row.status as string,
      clientIdMasked: maskClientId(row.client_id as string),
      lastVerifiedAt: row.last_verified_at ?? null,
      lastSyncAt: row.last_sync_at ?? null,
    };
  }
  const owner = await isOwnerWorkspace(tenantId);
  return {
    ...base,
    connected: owner,
    source: owner ? ("env" as const) : ("none" as const),
    status: owner ? "connected" : "not_connected",
    clientIdMasked: null,
    lastVerifiedAt: null,
    lastSyncAt: null,
  };
}

paypalRouter.get("/connection", async (req, res, next) => {
  try {
    res.json(await statusFor(req.auth!.tenantId));
  } catch (e) {
    next(e);
  }
});

paypalRouter.put("/connection", limiter, requireOwner, async (req, res, next) => {
  try {
    const a = req.auth!;
    if (!encryptionConfigured() || !sandboxOnly()) {
      res.status(503).json({ error: "Connecting a PayPal account is not available on this server." });
      return;
    }
    const body = connectionInput.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({
        error: "Enter the Sandbox Client ID and Secret exactly as shown in the PayPal developer dashboard.",
      });
      return;
    }
    const { clientId, clientSecret, password } = body.data;


    const ok = await verifyPassword(a.email ?? "", password);
    if (!ok) {
      await withTx((c) =>
        appendAudit(c, {
          tenantId: a.tenantId,
          actor: a.email ?? a.userId,
          action: "stepup.failed",
          targetType: "paypal_connection",
          targetId: a.tenantId,
        })
      );
      res.status(403).json({ error: "Re-authentication failed" });
      return;
    }

    
    const creds = { clientId, clientSecret };
    try {
      forgetToken(creds);
      await getAccessToken(creds);
    } catch (e) {
      if (e instanceof PayPalAuthError) {
        res.status(400).json({ error: "PayPal rejected these keys. Use the Client ID and Secret of a Sandbox app." });
        return;
      }
      throw e;
    }

    const blob = encryptSecret(clientSecret, a.tenantId, vaultKey());
    try {
      await withTx(async (c) => {
        await c.query(
          `insert into paypal_connections (tenant_id, client_id, secret_encrypted, status, last_verified_at)
           values ($1, $2, $3, 'connected', now())
           on conflict (tenant_id) do update set
             client_id = excluded.client_id,
             secret_encrypted = excluded.secret_encrypted,
             status = 'connected',
             last_verified_at = now(),
             updated_at = now()`,
          [a.tenantId, clientId, blob]
        );
   
        await appendAudit(c, {
          tenantId: a.tenantId,
          actor: a.email ?? a.userId,
          action: "paypal.connected",
          targetType: "paypal_connection",
          targetId: a.tenantId,
          details: { environment: "sandbox", clientId: maskClientId(clientId) },
        });
      });
    } catch (e) {
      if ((e as { code?: string }).code === "23505") {
        res.status(409).json({ error: "These keys are already connected to another workspace." });
        return;
      }
      throw e;
    }

    res.json(await statusFor(a.tenantId));
  } catch (e) {
    next(e);
  }
});

paypalRouter.delete("/connection", limiter, requireOwner, async (req, res, next) => {
  try {
    const a = req.auth!;
    const body = passwordOnly.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const ok = await verifyPassword(a.email ?? "", body.data.password);
    if (!ok) {
      await withTx((c) =>
        appendAudit(c, {
          tenantId: a.tenantId,
          actor: a.email ?? a.userId,
          action: "stepup.failed",
          targetType: "paypal_connection",
          targetId: a.tenantId,
        })
      );
      res.status(403).json({ error: "Re-authentication failed" });
      return;
    }

    const creds = await loadTenantCredentials(a.tenantId).catch(() => null);
    if (creds) forgetToken(creds);

    await withTx(async (c) => {
      const del = await c.query("delete from paypal_connections where tenant_id = $1 returning client_id", [
        a.tenantId,
      ]);
      if (del.rowCount) {
        await appendAudit(c, {
          tenantId: a.tenantId,
          actor: a.email ?? a.userId,
          action: "paypal.disconnected",
          targetType: "paypal_connection",
          targetId: a.tenantId,
          details: { clientId: maskClientId(del.rows[0].client_id as string) },
        });
      }
    });

    res.json(await statusFor(a.tenantId));
  } catch (e) {
    next(e);
  }
});

paypalRouter.post("/sync", limiter, requireOwner, async (req, res, next) => {
  try {
    const a = req.auth!;
    const resolved = await resolveCredentials(a.tenantId);
    if (!resolved) {
      res.status(403).json({ error: "Connect your PayPal Sandbox in Settings before syncing." });
      return;
    }

    try {
      const summary = await syncFromPayPal(a.tenantId, a.email ?? a.userId, resolved.creds);
      if (resolved.source === "tenant") {
        await pool.query(
          "update paypal_connections set last_sync_at = now(), status = 'connected' where tenant_id = $1",
          [a.tenantId]
        );
      }
      res.json(summary);
    } catch (e) {
      if (e instanceof PayPalAuthError && resolved.source === "tenant") {
        await pool.query("update paypal_connections set status = 'invalid' where tenant_id = $1", [a.tenantId]);
        res.status(422).json({ error: "PayPal rejected your saved keys. Reconnect them in Settings." });
        return;
      }
      throw e;
    }
  } catch (e) {
    next(e);
  }
});