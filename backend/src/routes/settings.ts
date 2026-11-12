import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { pool } from "../db/client";
import { withTx } from "../db/tx";
import { requireOwner } from "../middleware/auth";
import { appendAudit } from "../audit/log";
import { verifyPassword } from "../auth/stepUp";
import { fromMinor } from "../rules/money";
import { validateMaxRefund, MAX_REFUND_CEILING_MINOR } from "../rules/settings";

export const settingsRouter = Router();


const settingsLimiter = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, wait a minute" },
});

function shape(maxRefundMinor: number, currency: string) {
  return {
    maxRefundMinor,
    maxRefundFormatted: fromMinor(maxRefundMinor, currency),
    currency,
    ceilingMinor: MAX_REFUND_CEILING_MINOR,
    ceilingFormatted: fromMinor(MAX_REFUND_CEILING_MINOR, currency),
  };
}

settingsRouter.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "select max_refund_minor, default_currency from tenants where id = $1",
      [req.auth!.tenantId]
    );
    if (rows.length === 0) {
      res.status(404).json({ error: "Settings not found" });
      return;
    }
    res.json(shape(Number(rows[0].max_refund_minor), rows[0].default_currency));
  } catch (e) {
    next(e);
  }
});

const bodySchema = z.object({
  maxRefundMinor: z.unknown(),
  password: z.string().min(1).max(200),
});

settingsRouter.put("/", settingsLimiter, requireOwner, async (req, res, next) => {
  try {
    const a = req.auth!;
    const body = bodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const check = validateMaxRefund(body.data.maxRefundMinor);
    if (!check.ok) {
      res.status(400).json({ error: check.reason });
      return;
    }

    const ok = await verifyPassword(a.email ?? "", body.data.password);
    if (!ok) {
      await withTx((c) =>
        appendAudit(c, {
          tenantId: a.tenantId,
          actor: a.email ?? a.userId,
          action: "stepup.failed",
          targetType: "settings",
          targetId: a.tenantId,
        })
      );
      res.status(403).json({ error: "Re-authentication failed" });
      return;
    }

    const result = await withTx(async (c) => {
      const cur = await c.query(
        "select max_refund_minor, default_currency from tenants where id = $1 for update",
        [a.tenantId]
      );
      if (cur.rows.length === 0) return null;

      const before = Number(cur.rows[0].max_refund_minor);
      const currency = cur.rows[0].default_currency as string;
      if (before === check.value) return { changed: false, currency, value: before };

      await c.query("update tenants set max_refund_minor = $2 where id = $1", [
        a.tenantId,
        check.value,
      ]);
      await appendAudit(c, {
        tenantId: a.tenantId,
        actor: a.email ?? a.userId,
        action: "settings.updated",
        targetType: "settings",
        targetId: a.tenantId,
        details: { setting: "max_refund_minor", from: before, to: check.value, currency },
      });
      return { changed: true, currency, value: check.value };
    });

    if (!result) {
      res.status(404).json({ error: "Settings not found" });
      return;
    }
    res.json({ ...shape(result.value, result.currency), changed: result.changed });
  } catch (e) {
    next(e);
  }
});