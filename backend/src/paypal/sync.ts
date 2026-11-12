import { withTx } from "../db/tx";
import { appendAudit } from "../audit/log";
import { detectInjection } from "../ai/injection";
import { mapType, toMinor } from "../disputes/mapping";
import { listDisputes, getDispute, getCapture, getOrder } from "./api";
import { envCredentials, type PayPalCreds } from "./client";


const clean = (v: unknown, max = 200) =>
  String(v ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);

type Rec = { type: string; content: string };
type Msg = { role: "buyer" | "seller"; body: string; flagged: boolean; reasons: string[] };

async function buildRecords(d: any, creds: PayPalCreds): Promise<Rec[]> {
  const recs: Rec[] = [];

  recs.push({
    type: "dispute_details",
    content: `PayPal dispute ${clean(d.dispute_id)}: reason ${clean(d.reason)}, stage ${clean(
      d.dispute_life_cycle_stage
    )}, opened ${clean(d.create_time)}, amount ${clean(d.dispute_amount?.currency_code)} ${clean(
      d.dispute_amount?.value
    )}.`,
  });

  const txId = d.disputed_transactions?.[0]?.seller_transaction_id;
  if (typeof txId !== "string") return recs;

  const cap = await getCapture(txId, creds);
  if (!cap) return recs;

  recs.push({
    type: "payment",
    content: `Payment ${clean(cap.id)} of ${clean(cap.amount?.currency_code)} ${clean(
      cap.amount?.value
    )}, status ${clean(cap.status)}, created ${clean(cap.create_time)}.`,
  });


  const up = (cap.links ?? []).find((l: any) => l?.rel === "up");
  const orderId = typeof up?.href === "string" ? up.href.split("/").pop() : null;
  if (!orderId || !/^[A-Z0-9]{10,25}$/i.test(orderId)) return recs;

  const order = await getOrder(orderId, creds);
  if (!order) return recs;

  const unit = order.purchase_units?.[0];
  recs.push({
    type: "order",
    content: `Order ${clean(order.id)} created ${clean(order.create_time)}: ${clean(
      unit?.description || "no description"
    )}, ${clean(unit?.amount?.currency_code)} ${clean(unit?.amount?.value)}, status ${clean(
      order.status
    )}.`,
  });

  const addr = unit?.shipping?.address;
  if (addr) {
    
    const parts = [addr.admin_area_2, addr.admin_area_1, addr.postal_code, addr.country_code]
      .map((x: unknown) => clean(x, 60))
      .filter(Boolean);
    if (parts.length) {
      recs.push({
        type: "shipping_address",
        content: `Shipping address on the order: ${parts.join(", ")}.`,
      });
    }
  }
  return recs;
}

function buildMessages(d: any): Msg[] {
  const out: Msg[] = [];
  for (const m of (d.messages ?? []).slice(0, 50)) {
    const role = m?.posted_by === "BUYER" ? "buyer" : m?.posted_by === "SELLER" ? "seller" : null;
    const body = clean(m?.content, 2000);
    if (!role || !body) continue;
    const inj = role === "buyer" ? detectInjection(body) : { flagged: false, reasons: [] as string[] };
    out.push({ role, body, flagged: inj.flagged, reasons: inj.reasons });
  }
  return out;
}

export type SyncSummary = {
  fetched: number;
  imported: number;
  skippedOtherAccount: number;
  imports: { id: string; type: string; records: number; messages: number }[];
};

export async function syncFromPayPal(
  tenantId: string,
  actor: string,
  creds: PayPalCreds = envCredentials()
): Promise<SyncSummary> {
  const list = await listDisputes(creds);
  const summary: SyncSummary = {
    fetched: list.length,
    imported: 0,
    skippedOtherAccount: 0,
    imports: [],
  };

  for (const item of list.slice(0, 20)) {
    const id = item?.dispute_id;
    if (typeof id !== "string") continue;
    const d = await getDispute(id, creds);
    if (!d) continue;

    const records = await buildRecords(d, creds);
    const messages = buildMessages(d);

    for (const m of messages.filter((x) => x.role === "buyer" && !x.flagged).slice(0, 3)) {
      records.push({ type: "buyer_message", content: `Buyer message: ${JSON.stringify(m.body)}` });
    }

    const currency = typeof d.dispute_amount?.currency_code === "string" ? d.dispute_amount.currency_code : null;
    const amountMinor =
      currency && typeof d.dispute_amount?.value === "string"
        ? toMinor(d.dispute_amount.value, currency)
        : null;
    const type = mapType(d.reason);

    const disputeId = await withTx(async (c) => {
  
      const up = await c.query(
        `insert into disputes
           (tenant_id, paypal_dispute_id, dispute_type, reason, status,
            amount_minor, currency, opened_at, response_due_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         on conflict (paypal_dispute_id) do update set
           dispute_type = excluded.dispute_type,
           reason = excluded.reason,
           status = excluded.status,
           amount_minor = excluded.amount_minor,
           currency = excluded.currency,
           response_due_at = excluded.response_due_at,
           updated_at = now()
         where disputes.tenant_id = excluded.tenant_id
         returning id`,
        [
          tenantId, id, type, d.reason ?? null, d.status ?? "OPEN",
          amountMinor, currency, d.create_time ?? null, d.seller_response_due_date ?? null,
        ]
      );
      if (up.rowCount === 0) return null;
      const dbId = up.rows[0].id as string;

      await c.query(
        `delete from records where dispute_id = $1 and tenant_id = $2 and source = 'paypal'`,
        [dbId, tenantId]
      );
      await c.query(`delete from messages where dispute_id = $1 and tenant_id = $2`, [dbId, tenantId]);

      for (const r of records) {
        await c.query(
          `insert into records (tenant_id, dispute_id, record_type, source, content)
           values ($1,$2,$3,'paypal',$4)`,
          [tenantId, dbId, r.type, r.content]
        );
      }
      for (const m of messages) {
        await c.query(
          `insert into messages (tenant_id, dispute_id, sender_role, body, injection_flag, flag_reason)
           values ($1,$2,$3,$4,$5,$6)`,
          [tenantId, dbId, m.role, m.body, m.flagged, m.flagged ? m.reasons.join("; ") : null]
        );
      }
      return dbId;
    });

    if (!disputeId) {
      summary.skippedOtherAccount++;
      continue;
    }
    summary.imported++;
    summary.imports.push({ id, type, records: records.length, messages: messages.length });
  }

  await withTx((c) =>
    appendAudit(c, {
      tenantId,
      actor,
      action: "paypal.synced",
      details: {
        fetched: summary.fetched,
        imported: summary.imported,
        skippedOtherAccount: summary.skippedOtherAccount,
      },
    })
  );

  return summary;
}