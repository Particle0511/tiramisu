import { useState } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "../lib/useAsync";
import { listDisputes } from "../lib/queries";
import { deadlineText, formatDate, formatMoney } from "../lib/format";
import { deadlineTone, isOpen, statusLabel, typeLabel } from "../lib/labels";
import { Bar, ErrorBox, Loading, Pill } from "../components/ui";

type Filter = "all" | "open" | "resolved";

export default function Disputes() {
  const q = useAsync(listDisputes);
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  if (q.loading && !q.data) return <Loading label="Loading disputes" />;
  if (q.error && !q.data) return <ErrorBox message={q.error} onRetry={q.reload} />;

  const all = q.data?.disputes ?? [];
  const needle = term.trim().toLowerCase();
  const rows = all.filter((d) => {
    if (filter === "open" && !isOpen(d.status)) return false;
    if (filter === "resolved" && isOpen(d.status)) return false;
    if (!needle) return true;
    return `${d.paypalDisputeId} ${typeLabel(d.type)} ${d.reason ?? ""}`.toLowerCase().includes(needle);
  });

  return (
    <div>
      <div className="ap-head">
        <div>
          <h1>Disputes</h1>
          <p className="ap-sub">Every dispute, sorted by response deadline.</p>
        </div>
      </div>

      <div className="ap-toolbar">
        <input
          className="ap-input"
          type="search"
          placeholder="Search by ID, type or reason"
          aria-label="Search disputes"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        <div className="ap-seg" role="group" aria-label="Filter">
          {(["all", "open", "resolved"] as Filter[]).map((f) => (
            <button key={f} className={filter === f ? "on" : ""} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "open" ? "Open" : "Resolved"}
            </button>
          ))}
        </div>
      </div>

      <section className="ap-card" style={{ padding: 8 }}>
        {rows.length === 0 ? (
          <p className="ap-sub" style={{ padding: 20 }}>
            {all.length === 0 ? "No disputes yet. Load demo data from the Overview page." : "No disputes match this view."}
          </p>
        ) : (
          <div className="ap-table-wrap">
            <table className="ap-table">
              <thead>
                <tr>
                  <th>Dispute</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Deadline</th>
                  <th>Evidence</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div className="ap-cell-main">#{d.paypalDisputeId}</div>
                      <div className="ap-cell-sub">{typeLabel(d.type)}</div>
                    </td>
                    <td className="num">{formatMoney(d.amountMinor, d.currency)}</td>
                    <td>
                      <div>{statusLabel(d.status)}</div>
                      <div className="ap-cell-sub">Opened {formatDate(d.openedAt)}</div>
                    </td>
                    <td>
                      <Pill tone={deadlineTone(d.deadline)}>{deadlineText(d.deadline)}</Pill>
                    </td>
                    <td style={{ minWidth: 120 }}>
                      <div className="ap-cell-sub">{d.evidenceCompletenessPercent}% of required</div>
                      <Bar percent={d.evidenceCompletenessPercent} />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link className="ap-btn dark sm" to={`/disputes/${d.id}`}>
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}