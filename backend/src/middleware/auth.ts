import type { RequestHandler } from "express";
import { env } from "../config/env";
import { pool } from "../db/client";
import { withTx } from "../db/tx";
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
  const find = `select tenant_id, role from users where auth_user_id = $1`;
  const found = await pool.query(find, [userId]);
  if (found.rowCount) {
    return { tenantId: found.rows[0].tenant_id as string, role: found.rows[0].role as Role };
  }

  return withTx(async (c) => {
    // One request at a time per new user, so two tabs cannot create two tenants
    await c.query("select pg_advisory_xact_lock(hashtext($1))", [userId]);
    const again = await c.query(find, [userId]);
    if (again.rowCount) {
      return { tenantId: again.rows[0].tenant_id as string, role: again.rows[0].role as Role };
    }

    const name = email ? email.split("@")[0] : "Seller";
    const t = await c.query(`insert into tenants (name) values ($1) returning id`, [name]);
    const tenantId = t.rows[0].id as string;

    await c.query(
      `insert into users (auth_user_id, tenant_id, email, role) values ($1, $2, $3, 'owner')`,
      [userId, tenantId, email]
    );
    await appendAudit(c, {
      tenantId,
      actor: email ?? userId,
      action: "tenant.created",
      targetType: "tenant",
      targetId: tenantId,
    });
    return { tenantId, role: "owner" as Role };
  });
}

// The tenant comes ONLY from the verified user. Never from the request body or URL.
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
    next();
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