import { pool } from "../db/client";
import { chatJson, type ChatMessage } from "./provider";
import { buildPrompt } from "./prompts";
import { detectInjection } from "./injection";
import { linkStatements } from "../evidence/linker";
import { env } from "../config/env";

export const MAX_GENERATIONS = 3;

export class DraftError extends Error {
  constructor(
    public code: "not_found" | "limit_reached" | "ai_failed",
    message: string
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callModel(messages: ChatMessage[]): Promise<string> {
  try {
    return await chatJson(messages);
  } catch (e) {
    // One retry after a pause if the free tier rate limit was hit
    if ((e as Error).message.includes("429")) {
      await sleep(10_000);
      return await chatJson(messages);
    }
    throw e;
  }
}

function parseStatements(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const obj = JSON.parse(cleaned);
  const list = Array.isArray(obj) ? obj : obj?.statements;
  if (!Array.isArray(list)) return null;
  return list.slice(0, 12).map((s: any) => ({
    text: s?.text,
    sourceRecordIds: s?.sources,
  }));
}

export async function generateDraft(disputeId: string, tenantId: string) {
  // Always scoped to the tenant
  const d = await pool.query(
    `select dispute_type, ai_generations from disputes where id = $1 and tenant_id = $2`,
    [disputeId, tenantId]
  );
  if (d.rowCount === 0) throw new DraftError("not_found", "Dispute not found");

  // Atomic counter: counts failed attempts too, which protects the free quota
  const claim = await pool.query(
    `update disputes
        set ai_generations = ai_generations + 1, ai_status = 'pending'
      where id = $1 and tenant_id = $2 and ai_generations < $3
      returning dispute_type`,
    [disputeId, tenantId, MAX_GENERATIONS]
  );
  if (claim.rowCount === 0) {
    throw new DraftError(
      "limit_reached",
      `Draft limit reached (${MAX_GENERATIONS}). Showing the saved draft.`
    );
  }
  const disputeType: string = claim.rows[0].dispute_type ?? "OTHER";

  const recRows = await pool.query(
    `select id, record_type, content from records
      where dispute_id = $1 and tenant_id = $2 order by created_at, id`,
    [disputeId, tenantId]
  );
  const refs = recRows.rows.map((r, i) => ({
    ref: `R${i + 1}`,
    id: r.id as string,
    type: r.record_type as string,
    content: r.content as string,
  }));

  // Check every buyer message; flagged ones never reach the model
  const msgRows = await pool.query(
    `select id, body from messages
      where dispute_id = $1 and tenant_id = $2 and sender_role = 'buyer'
      order by created_at, id`,
    [disputeId, tenantId]
  );
  const safeMessages: string[] = [];
  const flaggedMessages: { id: string; reasons: string[] }[] = [];
  for (const m of msgRows.rows) {
    const result = detectInjection(m.body);
    await pool.query(
      `update messages set injection_flag = $1, flag_reason = $2 where id = $3 and tenant_id = $4`,
      [result.flagged, result.flagged ? result.reasons.join("; ") : null, m.id, tenantId]
    );
    if (result.flagged) flaggedMessages.push({ id: m.id, reasons: result.reasons });
    else safeMessages.push(m.body);
  }

  const prompt = buildPrompt(
    disputeType,
    refs.map((r) => ({ ref: r.ref, type: r.type, content: r.content })),
    safeMessages
  );

  let parsed: unknown;
  try {
    const raw = await callModel(prompt);
    parsed = parseStatements(raw);
  } catch (e) {
    const msg =
      e instanceof SyntaxError ? "AI returned invalid JSON" : (e as Error).message;
    await pool.query(
      `update disputes set ai_status = 'failed', ai_error = $1 where id = $2 and tenant_id = $3`,
      [msg, disputeId, tenantId]
    );
    throw new DraftError("ai_failed", msg);
  }

  // The evidence linker removes anything not backed by a real record
  const linked = linkStatements(
    parsed,
    refs.map((r) => ({ id: r.ref, type: r.type, content: r.content }))
  );
  const refToId = new Map(refs.map((r) => [r.ref, r.id]));

  const draft = {
    statements: linked.supported.map((s) => ({
      text: s.text,
      sourceRecordIds: s.sourceRecordIds.map((ref) => refToId.get(ref)!),
    })),
    dropped: linked.dropped,
    flaggedMessages,
    model: env.AI_MODEL,
    generatedAt: new Date().toISOString(),
  };

  await pool.query(
    `update disputes set ai_draft = $1, ai_status = 'done', ai_error = null
      where id = $2 and tenant_id = $3`,
    [JSON.stringify(draft), disputeId, tenantId]
  );

  return draft;
}