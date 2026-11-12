import { Link } from "react-router-dom";
import { useAsync } from "../lib/useAsync";
import { getRisks } from "../lib/queries";
import { ErrorBox, Loading, Pill } from "../components/ui";

const LABELS: Record<string, string> = {
  DEADLINE_OVERDUE: "Response deadline passed",
  DEADLINE_CRITICAL: "Under 24 hours left",
  DEADLINE_SOON: "Deadline is close",
  MISSING_TRACKING: "No tracking number",
  NO_DELIVERY_PROOF: "No delivery proof",
  LOW_EVIDENCE: "Thin evidence",
  HOSTILE_MESSAGE: "Flagged buyer message",
};
const TONE = { critical: "crit", warning: "warn", info: "neutral" } as const;
const SEV = { critical: "Critical", warning: "Warning", info: "Note" } as const;

export default function Prevention() {
  const q = useAsync(getRisks);
  if (q.loading && !q.data) return <Loading label="Scanning your disputes" />;
  if (q.error && !q.data) return <ErrorBox message={q.error} onRetry={q.reload} />;

  const alerts = q.data?.alerts ?? [];
  const n = (s: "critical" | "warning" | "info") => alerts.filter((a) => a.severity === s).length;
  const by = new Map<string, number>();
  for (const a of alerts) by.set(a.code, (by.get(a.code) ?? 0) + 1);
  const factors = Array.from(by.entries()).sort((a, b) => b[1] - a[1]);
  const max = factors[0]?.[1] ?? 1;

  return (
    <div>
      <div className="ap-head">
        <div>
          <h1>Prevention Radar</h1>
          <p className="ap-sub">Spot problems in your disputes before a deadline or a missing record costs you.</p>
        </div>
      </div>

      <section className="ap-card ap-hero-card" style={{ marginBottom: 20 }}>
        <img src="/assets/3d/prevention-radar.webp" alt="" />
        <div>
          <h2>{alerts.length === 0 ? "All clear" : `${alerts.length} thing${alerts.length === 1 ? "" : "s"} to look at`}</h2>
          <div className="ap-counters">
            <span className="ap-counter"><b>{n("critical")}</b><span className="ap-cell-sub">Critical</span></span>
            <span className="ap-counter"><b>{n("warning")}</b><span className="ap-cell-sub">Warnings</span></span>
            <span className="ap-counter"><b>{n("info")}</b><span className="ap-cell-sub">Notes</span></span>
          </div>
        </div>
      </section>

      {alerts.length > 0 && (
        <div className="ap-grid">
          <section className="ap-card">
            <h2 style={{ marginBottom: 14 }}>What needs attention</h2>
            <ul className="ap-records">
              {alerts.map((a) => (
                <li key={a.id} className="ap-alert-item">
                  <Pill tone={TONE[a.severity]}>{SEV[a.severity]}</Pill>
                  <div>
                    <strong>{a.title}</strong>
                    <p className="ap-cell-sub">#{a.paypalDisputeId}</p>
                    <p className="ap-cell-sub" style={{ marginTop: 4 }}>{a.detail}</p>
                  </div>
                  <Link className="ap-btn ghost sm" to={`/disputes/${a.disputeId}`}>
                    {a.proposedAction ? "Add tracking" : "Open"}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="ap-card">
            <h2 style={{ marginBottom: 14 }}>Top risk factors</h2>
            <div className="ap-bars">
              {factors.map(([code, count]) => (
                <div className="row" key={code}>
                  <span>{LABELS[code] ?? code}</span>
                  <span className="ap-cell-sub">{count}</span>
                  <div className="ap-bar"><span style={{ width: `${(count / max) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}