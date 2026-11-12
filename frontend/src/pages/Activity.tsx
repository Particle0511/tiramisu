import { useState } from "react";
import { useAsync } from "../lib/useAsync";
import { getAudit, verifyAudit } from "../lib/queries";
import { formatDate } from "../lib/format";
import { activityText, timeAgo } from "../lib/labels";
import { ErrorBox, Loading } from "../components/ui";

export default function Activity() {
  const q = useAsync(getAudit);
  const [check, setCheck] = useState<{ ok: boolean; checked: number; brokenAtSeq?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onVerify() {
    setBusy(true);
    setErr(null);
    try {
      setCheck(await verifyAudit());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (q.loading && !q.data) return <Loading label="Loading activity" />;
  if (q.error && !q.data) return <ErrorBox message={q.error} onRetry={q.reload} />;
  const entries = q.data?.entries ?? [];

  return (
    <div>
      <div className="ap-head">
        <div>
          <h1>Activity</h1>
          <p className="ap-sub">A complete history of every action, in order. Each entry is chained to the one before it.</p>
        </div>
        <div className="ap-actions">
          <button className="ap-btn ghost" onClick={() => void onVerify()} disabled={busy}>
            {busy ? "Checking" : "Verify history"}
          </button>
        </div>
      </div>

      {check && (
        <p className={check.ok ? "ap-notice" : "ap-error-text"} role="status" style={{ marginBottom: 20 }}>
          {check.ok
            ? `History is intact. ${check.checked} entries checked, none changed.`
            : `History was changed at entry ${check.brokenAtSeq}. ${check.checked} entries were intact before it.`}
        </p>
      )}
      {err && (
        <p className="ap-error-text" role="alert" style={{ marginBottom: 20 }}>
          {err}
        </p>
      )}

      <section className="ap-card">
        {entries.length === 0 ? (
          <p className="ap-sub">Nothing has happened yet.</p>
        ) : (
          <ul className="ap-timeline">
            {entries.map((a) => (
              <li key={a.seq}>
                <span className="dot" aria-hidden="true" />
                <div>
                  <div className="ap-cell-main">{activityText(a.action)}</div>
                  <div className="ap-cell-sub" title={formatDate(a.created_at, true)}>
                    {a.actor} · {timeAgo(a.created_at)}
                  </div>
                </div>
                <span className="ap-hash" title="Entry fingerprint">
                  #{a.seq} · {a.hash.slice(0, 8)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}