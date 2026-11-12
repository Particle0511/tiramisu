import type { RequestHandler } from "express";
import { env } from "../config/env";
import { pool } from "../db/client";
import { withTx } from "../db/tx";
import { runWithTenant } from "../db/context";
import { appendAudit } from "../audit/log";

export type Role = "owner" | "viewer";
export type AuthContext = {
  userId: string;
  email: string | null;
  tenantId: string;
  role: Role;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

async function provision(userId: string, email: string | null) {

  const found = await pool.query(
    "select out_tenant_id as tenant_id, out_role as role from app_find_user($1)",
    [userId]
  );
  if (found.rowCount) {
    return { tenantId: found.rows[0].tenant_id as string, role: found.rows[0].role as Role };
  }

  const made = await pool.query(
    "select out_tenant_id as tenant_id, out_role as role, created from app_provision_user($1, $2)",
    [userId, email]
  );
  const row = made.rows[0];
  const tenantId = row.tenant_id as string;

  if (row.created) {
    await runWithTenant(tenantId, () =>
      withTx((c) =>
        appendAudit(c, {
          tenantId,
          actor: email ?? userId,
          action: "tenant.created",
          targetType: "tenant",
          targetId: tenantId,
        })
      )
    );
  }
  return { tenantId, role: row.role as Role };
}


export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ") || header.length > 4096) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }
    const token = header.slice(7);

    const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }
    const u = (await r.json()) as { id?: string; email?: string };
    if (!u.id) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }

    const p = await provision(u.id, u.email ?? null);
    req.auth = { userId: u.id, email: u.email ?? null, tenantId: p.tenantId, role: p.role };


    runWithTenant(p.tenantId, () => next());
  } catch (e) {
    next(e);
  }
};

export const requireOwner: RequestHandler = (req, res, next) => {
  if (req.auth?.role !== "owner") {
    res.status(403).json({ error: "Owner access required" });
    return;
  }
  next();
};