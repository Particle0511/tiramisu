import { useState } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "../lib/useAsync";
import { getAudit, getMe, getPaypalConnection, getRisks, listDisputes, seedDemo } from "../lib/queries";
import { runSync } from "../lib/paypalSync";
import { deadlineText, formatMoney } from "../lib/format";
import { activityText, deadlineTone, greeting, isOpen, timeAgo, typeLabel, urgency } from "../lib/labels";
import { ErrorBox, Loading, Pill } from "../components/ui";
import type { Dispute } from "../lib/types";

function amountAtRisk(list: Dispute[]): string {
  const by = new Map<string, number>();
  for (const d of list) {
    if (d.amountMinor !== null && d.currency) by.set(d.currency, (by.get(d.currency) ?? 0) + d.amountMinor);
  }
  const parts = Array.from(by.entries()).map(([c, m]) => formatMoney(m, c));
  return parts.length ? parts.join(" + ") : "None";
}

function Stat({ img, label, value }: { img: string; label: string; value: string }) {
  return (
    <div className="ap-card ap-stat">
      <img className="ap-stat-img" src={`/assets/3d/${img}.webp`} alt="" />
      <div>
        <p className="ap-stat-label">{label}</p>
        <p className="ap-stat-value">{value}</p>
      </div>
    </div>
  );
}

type Notice = { ok: boolean; text: string; link?: string };

export default function Overview() {
  const me = useAsync(getMe);
  const disputes = useAsync(listDisputes);
  const risks = useAsync(getRisks);
  const audit = useAsync(getAudit);
  const conn = useAsync(getPaypalConnection);
  const [busy, setBusy] = useState<"seed" | "sync" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const isOwner = me.data?.role === "owner";
  const c = conn.data;

  const refreshAll = () => Promise.all([disputes.reload(), risks.reload(), audit.reload(), conn.reload()]);

  async function run(kind: "seed" | "sync") {
    setBusy(kind);
    setNotice(null);
    if (kind === "seed") {
      try {
        await seedDemo();
        await refreshAll();
        setNotice({ ok: true, text: "Demo disputes loaded." });
      } catch (e) {
        setNotice({ ok: false, text: (e as Error).message });
      }
    } else {
      const r = await runSync();
      if (r.ok) await refreshAll();
      setNotice(r.ok ? { ok: true, text: r.text } : { ok: false, text: r.text, link: r.link });
    }
    setBusy(null);
  }

  if (disputes.loading && !disputes.data) return <Loading label="Loading your disputes" />;
  if (disputes.error && !disputes.data) return <ErrorBox message={disputes.error} onRetry={disputes.reload} />;

  const list = disputes.data?.disputes ?? [];
  const open = list.filter((d) => isOpen(d.status));
  const alerts = risks.data?.alerts ?? [];
  const attentionAlerts = alerts.filter((a) => a.severity !== "info");
  const attention = new Set(attentionAlerts.map((a) => a.disputeId)).size;
  const avg = open.length ? Math.round(open.reduce((s, d) => s + d.evidenceCompletenessPercent, 0) / open.length) : null;
  const priority = open.slice(0, 5);
  const ready = open.find((d) => d.aiStatus === "done");
  const recent = (audit.data?.entries ?? []).slice(0, 5);

  return (
    <div>
      <div className="ap-head">
        <div>
          <h1>{greeting()}</h1>
          <p className="ap-sub">Here is what is happening with your seller protection today.</p>
        </div>
        {isOwner && list.length > 0 && c && (
          <div className="ap-actions">
            {c.connected ? (
              <button className="ap-btn ghost" onClick={() => void run("sync")} disabled={busy !== null}>
                {busy === "sync" ? "Syncing" : "Sync PayPal Sandbox"}
              </button>
            ) : c.canConnect ? (
              <Link className="ap-btn ghost" to="/settings">Connect PayPal</Link>
            ) : null}
          </div>
        )}
      </div>

      {notice && (
        <p className={notice.ok ? "ap-notice" : "ap-notice warn"} role="status" style={{ marginBottom: 20 }}>
          {notice.text}{" "}
          {notice.link && (
            <Link to="/settings" className="ap-link">
              {notice.link}
            </Link>
          )}
        </p>
      )}

      {list.length === 0 ? (
        <div className="ap-card ap-empty">
          <img src="/assets/3d/delivery-package.webp" alt="" />
          <h2>No disputes yet</h2>
          <p className="ap-sub">
            {c && !c.canConnect && !c.connected
              ? "Load three fictional demo disputes to try the full flow."
              : "Connect your own PayPal Sandbox to see your test disputes here, or load three fictional demo disputes to try the full flow."}
          </p>
          {isOwner ? (
            <div className="ap-actions" style={{ marginTop: 18, justifyContent: "center" }}>
              {c?.connected ? (
                <button className="ap-btn dark" onClick={() => void run("sync")} disabled={busy !== null}>
                  {busy === "sync" ? "Syncing" : "Sync PayPal Sandbox"}
                </button>
              ) : c && c.canConnect ? (
                <Link className="ap-btn dark" to="/settings">Connect your PayPal Sandbox</Link>
              ) : null}
              <button
                className={"ap-btn " + (c && (c.connected || c.canConnect) ? "ghost" : "dark")}
                onClick={() => void run("seed")}
                disabled={busy !== null}
              >
                {busy === "seed" ? "Loading" : "Load demo data"}
              </button>
            </div>
          ) : (
            <p className="ap-sub" style={{ marginTop: 14 }}>
              Ask the account owner to load data.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="ap-stats">
            <Stat img="delivery-package" label="Active disputes" value={String(open.length)} />
            <Stat img="payment-coins" label="Amount at risk" value={amountAtRisk(open)} />
            <Stat img="notification-bell" label="Need attention" value={risks.data ? String(attention) : "..."} />
            <Stat img="evidence-document" label="Evidence completeness" value={avg === null ? "N/A" : `${avg}%`} />
          </div>

          <div className="ap-grid">
            <div className="ap-stack">
              <section className="ap-card">
                <div className="ap-row-head">
                  <h2>Priority cases</h2>
                  <Link to="/disputes" className="ap-link">View all</Link>
                </div>
                {priority.length === 0 ? (
                  <p className="ap-sub">No open disputes. Nothing needs a response.</p>
                ) : (
                  <div className="ap-table-wrap">
                    <table className="ap-table">
                      <thead>
                        <tr><th>Priority</th><th>Dispute</th><th>Deadline</th><th /></tr>
                      </thead>
                      <tbody>
                        {priority.map((d) => {
                          const u = urgency(d.deadline);
                          return (
                            <tr key={d.id}>
                              <td><Pill tone={u.tone}>{u.label}</Pill></td>
                              <td>
                                <div className="ap-cell-main">#{d.paypalDisputeId}</div>
                                <div className="ap-cell-sub">{typeLabel(d.type)} · {formatMoney(d.amountMinor, d.currency)}</div>
                              </td>
                              <td><Pill tone={deadlineTone(d.deadline)}>{deadlineText(d.deadline)}</Pill></td>
                              <td style={{ textAlign: "right" }}>
                                <Link className="ap-btn dark sm" to={`/disputes/${d.id}`}>Review</Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="ap-card">
                <h2 style={{ marginBottom: 12 }}>Recent activity</h2>
                {recent.length === 0 ? (
                  <p className="ap-sub">Nothing has happened yet.</p>
                ) : (
                  <ul className="ap-activity">
                    {recent.map((a) => (
                      <li key={a.seq}>
                        <span>{activityText(a.action)}</span>
                        <span className="ap-sub">{timeAgo(a.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <div className="ap-stack">
              <section className="ap-card ap-dark">
                <img className="ap-dark-img" src="/assets/3d/approval-lock.webp" alt="" />
                {ready ? (
                  <>
                    <h2>Draft response ready</h2>
                    <p>Your evidence-backed response for #{ready.paypalDisputeId} is ready to review. Nothing is sent without your approval.</p>
                    <Link className="ap-btn gold" to={`/disputes/${ready.id}`}>Review draft</Link>
                  </>
                ) : (
                  <>
                    <h2>No draft yet</h2>
                    <p>Open a dispute and generate a draft from its AI Response tab. Every statement links to a real record.</p>
                    {priority[0] && <Link className="ap-btn gold" to={`/disputes/${priority[0].id}`}>Open top case</Link>}
                  </>
                )}
              </section>

              <section className="ap-card">
                <h2 style={{ marginBottom: 12 }}>Needs your attention</h2>
                {attentionAlerts.length === 0 ? (
                  <p className="ap-sub">No warnings right now.</p>
                ) : (
                  <ul className="ap-alerts">
                    {attentionAlerts.slice(0, 4).map((a) => (
                      <li key={a.id}>
                        <Pill tone={a.severity === "critical" ? "crit" : "warn"}>{a.severity === "critical" ? "Critical" : "Warning"}</Pill>
                        <Link to={`/disputes/${a.disputeId}`}>
                          <strong>{a.title}</strong>
                          <span className="ap-sub">#{a.paypalDisputeId}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}