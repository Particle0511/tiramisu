import { Link } from "react-router-dom";
import { useAsync } from "../lib/useAsync";
import { listDisputes } from "../lib/queries";
import { formatMoney } from "../lib/format";
import { isOpen, typeLabel } from "../lib/labels";
import { Bar, ErrorBox, Loading } from "../components/ui";

export default function Evidence() {
  const q = useAsync(listDisputes);
  if (q.loading && !q.data) return <Loading label="Checking your evidence" />;
  if (q.error && !q.data) return <ErrorBox message={q.error} onRetry={q.reload} />;

  const open = (q.data?.disputes ?? []).filter((d) => isOpen(d.status));
  const avg = open.length ? Math.round(open.reduce((s, d) => s + d.evidenceCompletenessPercent, 0) / open.length) : null;
  const missing = new Map<string, number>();
  for (const d of open) for (const m of d.missingRequired) missing.set(m, (missing.get(m) ?? 0) + 1);
  const top = Array.from(missing.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topMax = top[0]?.[1] ?? 1;

  return (
    <div>
      <div className="ap-head">
        <div>
          <h1>Evidence Intelligence</h1>
          <p className="ap-sub">See which required records each dispute has, and which are still missing.</p>
        </div>
      </div>

      {open.length === 0 ? (
        <div className="ap-card ap-empty" style={{ marginTop: 0 }}>
          <img src="/assets/3d/evidence-document.webp" alt="" />
          <h2>No open disputes</h2>
          <p className="ap-sub">Evidence is tracked for every open dispute. Sync or load demo data to see it.</p>
        </div>
      ) : (
        <>
          <div className="ap-split" style={{ marginBottom: 20 }}>
            <section className="ap-card ap-hero-card">
              <img src="/assets/3d/evidence-document.webp" alt="" />
              <div>
                <p className="ap-stat-label">Average completeness of required evidence</p>
                <p className="ap-stat-value" style={{ fontSize: "2.2rem" }}>{avg}%</p>
                <p className="ap-cell-sub">Across {open.length} open dispute{open.length === 1 ? "" : "s"}. This is not a chance of winning.</p>
              </div>
            </section>
            <section className="ap-card">
              <h2 style={{ marginBottom: 14 }}>Most often missing</h2>
              {top.length === 0 ? (
                <p className="ap-sub">Every required record has been found.</p>
              ) : (
                <div className="ap-bars">
                  {top.map(([label, count]) => (
                    <div className="row" key={label}>
                      <span>{label}</span>
                      <span className="ap-cell-sub">{count}</span>
                      <div className="ap-bar"><span style={{ width: `${(count / topMax) * 100}%` }} /></div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="ap-stack">
            {open.map((d) => (
              <section className="ap-card" key={d.id}>
                <div className="ap-row-head">
                  <div>
                    <h2>#{d.paypalDisputeId}</h2>
                    <p className="ap-cell-sub">{typeLabel(d.type)} · {formatMoney(d.amountMinor, d.currency)}</p>
                  </div>
                  <Link className="ap-btn ghost sm" to={`/disputes/${d.id}`}>Open</Link>
                </div>
                <p className="ap-cell-sub">{d.evidenceCompletenessPercent}% of required evidence found</p>
                <Bar percent={d.evidenceCompletenessPercent} />
                <div className="ap-chips" style={{ marginTop: 14 }}>
                  {d.checklist.items.map((i) => (
                    <span key={i.key} className={"ap-chip " + (i.found ? "found" : i.required ? "miss" : "opt")}>
                      {i.found ? "✓ " : i.required ? "! " : ""}
                      {i.label}
                      {!i.found && !i.required ? " (optional)" : ""}
                    </span>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}