import type { PoolClient } from "pg";
import { pool } from "../db/client";
import { computeHash } from "./hash";

export type AuditInput = {
  tenantId: string;
  actor: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>; // plain JSON only, and never secrets
};

// Call inside a transaction so the log entry and the change commit together
export async function appendAudit(c: PoolClient, input: AuditInput): Promise<void> {
  // One writer per tenant at a time, so the chain cannot fork
  await c.query("select pg_advisory_xact_lock(hashtext($1))", [input.tenantId]);

  const last = await c.query(
    `select seq, hash from audit_log where tenant_id = $1 order by seq desc limit 1`,
    [input.tenantId]
  );
  const seq = last.rowCount ? Number(last.rows[0].seq) + 1 : 1;
  const prevHash: string = last.rowCount ? last.rows[0].hash : "GENESIS";
  const createdAt = new Date();
  const details = input.details ?? {};

  const hash = computeHash({
    tenantId: input.tenantId,
    seq,
    actor: input.actor,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    details,
    prevHash,
    createdAt: createdAt.toISOString(),
  });

  await c.query(
    `insert into audit_log
       (tenant_id, seq, actor, action, target_type, target_id, details, prev_hash, hash, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      input.tenantId, seq, input.actor, input.action,
      input.targetType ?? null, input.targetId ?? null,
      JSON.stringify(details), prevHash, hash, createdAt,
    ]
  );
}

export async function verifyChain(
  tenantId: string
): Promise<{ ok: boolean; checked: number; brokenAtSeq?: number }> {
  const { rows } = await pool.query(
    `select seq, actor, action, target_type, target_id, details, prev_hash, hash, created_at
       from audit_log where tenant_id = $1 order by seq`,
    [tenantId]
  );

  let prev = "GENESIS";
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const seq = Number(r.seq);
    if (seq !== i + 1 || r.prev_hash !== prev) {
      return { ok: false, checked: i, brokenAtSeq: seq };
    }
    const expected = computeHash({
      tenantId,
      seq,
      actor: r.actor,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      details: r.details,
      prevHash: r.prev_hash,
      createdAt: (r.created_at as Date).toISOString(),
    });
    if (expected !== r.hash) return { ok: false, checked: i, brokenAtSeq: seq };
    prev = r.hash;
  }
  return { ok: true, checked: rows.length };
}