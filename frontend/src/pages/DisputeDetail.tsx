import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAsync } from "../lib/useAsync";
import { createAction, createRespond, generateDraft, getDispute, getMe } from "../lib/queries";
import { deadlineText, formatDate, formatMoney } from "../lib/format";
import { deadlineTone, recordLabel, statusLabel, typeLabel, urgency } from "../lib/labels";
import { actionTitle, modalFromPending } from "../lib/actionModal";
import { Bar, ErrorBox, Loading, Pill } from "../components/ui";
import { ApprovalModal, type ModalAction } from "../components/ApprovalModal";
import { RefundForm } from "../components/RefundForm";

type Tab = "overview" | "evidence" | "response";

// The same sentence is shown to the seller and sent to PayPal with the offer.
const OFFER_NOTE = "Offering a refund to resolve this dispute.";

function statusTone(s: string): "ok" | "warn" | "crit" | "neutral" {
  if (s === "executed") return "ok";
  if (s === "pending" || s === "approved") return "warn";
  if (s === "failed" || s === "expired") return "crit";
  return "neutral";
}

function TrackingForm({ onSubmit, busy }: { onSubmit: (tracking: string, carrier: string) => void; busy: boolean }) {
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("");
  const [errs, setErrs] = useState<{ tracking?: string; carrier?: string }>({});

  function submit(e: FormEvent) {
    e.preventDefault();
    const t = tracking.trim();
    const c = carrier.trim();
    const next: { tracking?: string; carrier?: string } = {};
    if (t.length < 5 || t.length > 40 || !/^[A-Za-z0-9-]+$/.test(t)) {
      next.tracking = "Use 5 to 40 letters, numbers or hyphens, with no spaces.";
    }
    if (c.length < 2 || c.length > 40 || !/^[A-Za-z0-9 ._-]+$/.test(c)) {
      next.carrier = "Use 2 to 40 characters: letters, numbers, spaces, dots, hyphens or underscores.";
    }
    setErrs(next);
    if (!next.tracking && !next.carrier) onSubmit(t, c);
  }

  return (
    <form onSubmit={submit} className="ap-form">
      <div className="ap-field">
        <label htmlFor="trk">Tracking number</label>
        <input id="trk" className="ap-input" value={tracking} onChange={(e) => setTracking(e.target.value)} />
        {errs.tracking && <p className="ap-error-text" role="alert">{errs.tracking}</p>}
      </div>
      <div className="ap-field">
        <label htmlFor="car">Carrier</label>
        <input id="car" className="ap-input" placeholder="For example, DHL or Blue Dart" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
        {errs.carrier && <p className="ap-error-text" role="alert">{errs.carrier}</p>}
      </div>
      <button className="ap-btn dark" type="submit" disabled={busy || !tracking.trim() || !carrier.trim()}>
        {busy ? "Preparing" : "Prepare tracking upload"}
      </button>
    </form>
  );
}

export default function DisputeDetail() {
  const { id = "" } = useParams();
  const me = useAsync(getMe);
  const q = useAsync(() => getDispute(id), [id]);
  const [tab, setTab] = useState<Tab>("overview");
  const [modal, setModal] = useState<ModalAction | null>(null);
  const [busy, setBusy] = useState<"gen" | "send" | "track" | "refund" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const isOwner = me.data?.role === "owner";

  if (q.loading && !q.data) return <Loading label="Loading dispute" />;
  if (q.error && !q.data) return <ErrorBox message={q.error} onRetry={q.reload} />;
  if (!q.data) return null;

  const { dispute: d, records, messages, options, draft, actions } = q.data;
  const u = urgency(d.deadline);
  const pending = actions.filter((a) => a.status === "pending");
  const trackingMissing =
    d.type === "ITEM_NOT_RECEIVED" && d.checklist.items.some((i) => i.key === "tracking" && !i.found);
  const recLabel = (rid: string) => {
    const r = records.find((x) => x.id === rid);
    return r ? recordLabel(r.record_type) : "Record";
  };

  async function onGenerate() {
    setBusy("gen");
    setMsg(null);
    try {
      await generateDraft(id);
      await q.reload();
      setTab("response");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onSend() {
    setBusy("send");
    setMsg(null);
    try {
      const r = await createRespond(id);
      setModal({
        id: r.id,
        title: actionTitle("RESPOND"),
        message: r.message,
        expiresAt: r.expiresAt,
        lines: [["Dispute", `#${d.paypalDisputeId}`]],
      });
      await q.reload();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onTracking(trackingNumber: string, carrier: string) {
    setBusy("track");
    setMsg(null);
    try {
      const r = await createAction({ disputeId: id, actionType: "UPLOAD_TRACKING", payload: { trackingNumber, carrier } });
      setModal({
        id: r.id,
        title: actionTitle("UPLOAD_TRACKING"),
        expiresAt: r.expiresAt,
        lines: [["Tracking number", trackingNumber], ["Carrier", carrier]],
      });
      await q.reload();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onRefund(amountMinor: number) {
    setBusy("refund");
    setMsg(null);
    try {
      const r = await createAction({
        disputeId: id,
        actionType: "REFUND",
        amountMinor,
        currency: d.currency ?? undefined,
        payload: { note: OFFER_NOTE },
      });
      setModal({
        id: r.id,
        title: actionTitle("REFUND"),
        message: OFFER_NOTE,
        expiresAt: r.expiresAt,
        lines: [
          ["Dispute", `#${d.paypalDisputeId}`],
          ["Refund offer", formatMoney(amountMinor, d.currency)],
        ],
      });
      await q.reload();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const generateLabel = busy === "gen" ? "Generating draft" : draft ? "Regenerate draft" : "Generate draft";
  const canGenerate = isOwner && d.generationsLeft > 0 && busy === null;

  return (
    <div>
      <Link to="/disputes" className="ap-back">
        Back to disputes
      </Link>

      <div className="ap-dhead">
        <div>
          <div className="ap-title-row">
            <Pill tone={u.tone}>{u.label}</Pill>
            <h1>Dispute #{d.paypalDisputeId}</h1>
          </div>
          <p className="ap-sub">
            {typeLabel(d.type)} · {formatMoney(d.amountMinor, d.currency)} · {statusLabel(d.status)}
          </p>
        </div>
        <div className="ap-card ap-deadline">
          <p className="ap-stat-label">Response deadline</p>
          <p className="ap-stat-value">
            <Pill tone={deadlineTone(d.deadline)}>{deadlineText(d.deadline)}</Pill>
          </p>
          {d.deadline && (
            <p className="ap-cell-sub">
              {formatDate(d.deadline.dueAt, true)}
              {d.deadline.source === "estimated" ? " (estimated)" : ""}
            </p>
          )}
        </div>
      </div>

      <div className="ap-tabs" role="tablist">
        {(
          [
            ["overview", "Overview"],
            ["evidence", "Evidence"],
            ["response", "AI response"],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </div>

      {msg && (
        <p className="ap-error-text" role="alert" style={{ marginBottom: 16 }}>
          {msg}
        </p>
      )}

      {tab === "overview" && (
        <div className="ap-split">
          <div className="ap-stack">
            <section className="ap-card">
              <h2 style={{ marginBottom: 14 }}>Case details</h2>
              <dl className="ap-dl">
                <div><dt>Status</dt><dd>{statusLabel(d.status)}</dd></div>
                <div><dt>Type</dt><dd>{typeLabel(d.type)}</dd></div>
                <div><dt>Reason</dt><dd>{d.reason ? statusLabel(d.reason) : "Not available"}</dd></div>
                <div><dt>Amount</dt><dd>{formatMoney(d.amountMinor, d.currency)}</dd></div>
                <div><dt>Opened</dt><dd>{formatDate(d.openedAt)}</dd></div>
                <div><dt>Response due</dt><dd>{formatDate(d.responseDueAt, true)}</dd></div>
              </dl>
            </section>

            <section className="ap-card">
              <div className="ap-row-head">
                <h2>Evidence checklist</h2>
                <span className="ap-cell-sub">{d.evidenceCompletenessPercent}% of required</span>
              </div>
              <Bar percent={d.evidenceCompletenessPercent} />
              <ul className="ap-checklist">
                {d.checklist.items.map((i) => (
                  <li key={i.key} className={i.found ? "found" : "missing"}>
                    <span className="ap-tick" aria-hidden="true">{i.found ? "✓" : "!"}</span>
                    <span>{i.label}</span>
                    <span className="ap-cell-sub">{i.found ? "Found" : i.required ? "Missing" : "Optional"}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="ap-stack">
            <section className="ap-card">
              <h2 style={{ marginBottom: 6 }}>Next step</h2>
              {pending.length > 0 ? (
                <>
                  <p className="ap-sub">An action is waiting for your approval. Nothing is sent until you approve it.</p>
                  <button className="ap-btn dark" style={{ marginTop: 14 }} onClick={() => setModal(modalFromPending(pending[0]))} disabled={!isOwner}>
                    Review pending action
                  </button>
                </>
              ) : trackingMissing ? (
                <>
                  <p className="ap-sub">There is no tracking number on file. Proof of shipment is the first thing this dispute needs.</p>
                  {isOwner ? <TrackingForm onSubmit={(t, c) => void onTracking(t, c)} busy={busy === "track"} /> : <p className="ap-sub" style={{ marginTop: 10 }}>Ask the account owner to add it.</p>}
                </>
              ) : !draft ? (
                <>
                  <p className="ap-sub">Generate a draft response. Every statement must link to a real record.</p>
                  {isOwner && (
                    <button className="ap-btn dark" style={{ marginTop: 14 }} onClick={() => void onGenerate()} disabled={!canGenerate}>
                      {generateLabel}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p className="ap-sub">A draft is ready. Read it, then approve and send it.</p>
                  <button className="ap-btn dark" style={{ marginTop: 14 }} onClick={() => setTab("response")}>
                    Open AI response
                  </button>
                </>
              )}
            </section>

            {options && (
              <section className="ap-card">
                <h2 style={{ marginBottom: 14 }}>Your options</h2>
                <ul className="ap-options">
                  {options.options.map((o) => (
                    <li key={o.key} className={o.available ? "" : "off"}>
                      <div className="ap-row-head" style={{ marginBottom: 4 }}>
                        <strong>{o.label}</strong>
                        {!o.available && <Pill tone="neutral">Not available</Pill>}
                      </div>
                      <p className="ap-cell-sub">
                        {o.bestCaseLossMinor === o.worstCaseLossMinor
                          ? `Loss: ${formatMoney(o.bestCaseLossMinor, options.currency)}`
                          : `Loss: ${formatMoney(o.bestCaseLossMinor, options.currency)} to ${formatMoney(o.worstCaseLossMinor, options.currency)}`}
                      </p>
                      <p className="ap-cell-sub">{o.note}</p>
                    </li>
                  ))}
                </ul>
                <p className="ap-cell-sub" style={{ marginTop: 12 }}>{options.assumptions[0]}</p>
              </section>
            )}

            {isOwner && d.amountMinor !== null && d.currency && d.status.toUpperCase() !== "RESOLVED" && (
              <section className="ap-card">
                <h2 style={{ marginBottom: 6 }}>Offer a refund</h2>
                <p className="ap-sub">
                  This sends the buyer a refund offer through PayPal, and the buyer decides whether to accept it. You
                  approve it with your password first. An offer above your refund limit in Settings is blocked. On a demo
                  dispute the offer is only simulated.
                </p>
                <RefundForm
                  amountMinor={d.amountMinor}
                  currency={d.currency}
                  busy={busy === "refund"}
                  onPrepare={(m) => void onRefund(m)}
                />
              </section>
            )}
          </div>
        </div>
      )}

      {tab === "evidence" && (
        <div className="ap-split">
          <section className="ap-card">
            <h2 style={{ marginBottom: 14 }}>Records ({records.length})</h2>
            {records.length === 0 ? (
              <p className="ap-sub">No records found for this dispute yet.</p>
            ) : (
              <ul className="ap-records">
                {records.map((r) => (
                  <li key={r.id}>
                    <div className="ap-row-head" style={{ marginBottom: 6 }}>
                      <strong>{recordLabel(r.record_type)}</strong>
                      {r.source && <span className="ap-cell-sub">{r.source}</span>}
                    </div>
                    <p className="ap-plain">{r.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="ap-card">
            <h2 style={{ marginBottom: 14 }}>Messages ({messages.length})</h2>
            {messages.length === 0 ? (
              <p className="ap-sub">No messages.</p>
            ) : (
              <ul className="ap-records">
                {messages.map((m) => (
                  <li key={m.id}>
                    <div className="ap-row-head" style={{ marginBottom: 6 }}>
                      <strong>{statusLabel(m.sender_role)}</strong>
                      <span className="ap-cell-sub">{formatDate(m.created_at, true)}</span>
                    </div>
                    {m.injection_flag && (
                      <p className="ap-flag">
                        Flagged. This message tries to give instructions to the assistant, so it was kept away from the AI.
                      </p>
                    )}
                    <p className="ap-plain">{m.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {tab === "response" && (
        <div className="ap-split">
          <section className="ap-card">
            <div className="ap-row-head">
              <h2>AI response draft</h2>
              {draft && <Pill tone="ok">Every statement linked</Pill>}
            </div>
            {!draft ? (
              <p className="ap-sub">No draft yet. A draft only keeps statements that a real record supports.</p>
            ) : draft.statements.length === 0 ? (
              <p className="ap-sub">The draft had no statement that a record could support. Add evidence, then regenerate.</p>
            ) : (
              <ol className="ap-statements">
                {draft.statements.map((s, i) => (
                  <li key={i}>
                    <p>{s.text}</p>
                    <div className="ap-chips">
                      {s.sourceRecordIds.map((rid, j) => (
                        <span key={rid + j} className="ap-chip">{recLabel(rid)}</span>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {draft && (
              <p className="ap-cell-sub" style={{ marginTop: 12 }}>
                Generated {formatDate(draft.generatedAt, true)} by {draft.model}.
                {draft.dropped.length > 0 && ` ${draft.dropped.length} unsupported statement(s) were removed.`}
                {draft.flaggedMessages.length > 0 && ` ${draft.flaggedMessages.length} buyer message(s) were kept away from the AI.`}
              </p>
            )}
            <p className="ap-notice" style={{ marginTop: 16 }}>Nothing will be sent without your approval.</p>
            {isOwner && (
              <div className="ap-actions" style={{ marginTop: 16 }}>
                <button className="ap-btn ghost" onClick={() => void onGenerate()} disabled={!canGenerate}>
                  {generateLabel}
                </button>
                <button className="ap-btn dark" onClick={() => void onSend()} disabled={!draft || draft.statements.length === 0 || busy !== null}>
                  {busy === "send" ? "Preparing" : "Approve and send"}
                </button>
              </div>
            )}
            <p className="ap-cell-sub" style={{ marginTop: 10 }}>
              {d.generationsLeft} draft generation{d.generationsLeft === 1 ? "" : "s"} left for this dispute.
            </p>
          </section>

          <section className="ap-card">
            <h2 style={{ marginBottom: 14 }}>Actions on this dispute</h2>
            {actions.length === 0 ? (
              <p className="ap-sub">No actions yet.</p>
            ) : (
              <ul className="ap-records">
                {actions.map((a) => (
                  <li key={a.id}>
                    <div className="ap-row-head" style={{ marginBottom: 4 }}>
                      <strong>{actionTitle(a.action_type)}</strong>
                      <Pill tone={statusTone(a.status)}>{statusLabel(a.status)}</Pill>
                    </div>
                    <p className="ap-cell-sub">Created {formatDate(a.created_at, true)}</p>
                    {a.status === "pending" && isOwner && (
                      <button className="ap-btn dark sm" style={{ marginTop: 10 }} onClick={() => setModal(modalFromPending(a))}>
                        Review
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {modal && (
        <ApprovalModal
          action={modal}
          onClose={(changed) => {
            setModal(null);
            if (changed) void q.reload();
          }}
        />
      )}
    </div>
  );
}