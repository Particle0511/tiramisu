import { useState } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "../lib/useAsync";
import { getDispute, getMe, listDisputes } from "../lib/queries";
import { actionTitle, modalFromPending } from "../lib/actionModal";
import { formatDate } from "../lib/format";
import { statusLabel, typeLabel } from "../lib/labels";
import { ApprovalModal, type ModalAction } from "../components/ApprovalModal";
import { ErrorBox, Loading, Pill } from "../components/ui";
import type { Dispute, PendingAction } from "../lib/types";

type Item = { dispute: Dispute; action: PendingAction };


async function loadActions(): Promise<Item[]> {
  const { disputes } = await listDisputes();
  const groups = await Promise.all(
    disputes.slice(0, 30).map((dispute) =>
      getDispute(dispute.id)
        .then((r) => r.actions.map((action) => ({ dispute, action })))
        .catch(() => [] as Item[])
    )
  );
  return groups.reduce<Item[]>((acc, g) => acc.concat(g), []);
}

export default function Approvals() {
  const me = useAsync(getMe);
  const q = useAsync(loadActions);
  const [modal, setModal] = useState<ModalAction | null>(null);
  const isOwner = me.data?.role === "owner";

  if (q.loading && !q.data) return <Loading label="Checking for pending actions" />;
  if (q.error && !q.data) return <ErrorBox message={q.error} onRetry={q.reload} />;

  const items = q.data ?? [];
  const now = Date.now();
  const live = items.filter((i) => i.action.status === "pending" && new Date(i.action.expires_at).getTime() > now);
  const past = items
    .filter((i) => !live.includes(i))
    .sort((a, b) => new Date(b.action.created_at).getTime() - new Date(a.action.created_at).getTime())
    .slice(0, 10);

  const pastLabel = (a: PendingAction) =>
    a.status === "pending" ? { text: "Expired", tone: "crit" as const } : {
      text: statusLabel(a.status),
      tone: a.status === "executed" ? ("ok" as const) : a.status === "failed" || a.status === "expired" ? ("crit" as const) : ("neutral" as const),
    };

  return (
    <div>
      <div className="ap-head">
        <div>
          <h1>Approval Center</h1>
          <p className="ap-sub">Review and authorise every action before anything reaches PayPal.</p>
        </div>
      </div>

      {live.length === 0 ? (
        <div className="ap-card ap-empty" style={{ marginTop: 0 }}>
          <img src="/assets/3d/approval-lock.webp" alt="" />
          <h2>Nothing is waiting for approval</h2>
          <p className="ap-sub">
            Generate a draft on a dispute and press Approve and send. It will wait here until you confirm it with your password.
          </p>
          <Link className="ap-btn dark" style={{ marginTop: 18 }} to="/disputes">Go to disputes</Link>
        </div>
      ) : (
        <div className="ap-stack">
          {live.map(({ dispute, action }) => {
            const m = modalFromPending(action);
            return (
              <article className="ap-card ap-approval" key={action.id}>
                <img src="/assets/3d/approval-lock.webp" alt="" />
                <div>
                  <h2>{actionTitle(action.action_type)}</h2>
                  <p className="ap-cell-sub">
                    Dispute #{dispute.paypalDisputeId} · {typeLabel(dispute.type)} · expires {formatDate(action.expires_at, true)}
                  </p>
                  {m.message && (
                    <p className="ap-plain ap-preview">{m.message.length > 220 ? m.message.slice(0, 220) + "..." : m.message}</p>
                  )}
                  {m.lines.map(([k, v]) => (
                    <p key={k} className="ap-cell-sub">{k}: {v}</p>
                  ))}
                  <div className="ap-actions" style={{ marginTop: 14 }}>
                    <button className="ap-btn dark" onClick={() => setModal(m)} disabled={!isOwner}>
                      Review and approve
                    </button>
                    <Link className="ap-btn ghost" to={`/disputes/${dispute.id}`}>Open dispute</Link>
                  </div>
                  {!isOwner && <p className="ap-sub" style={{ marginTop: 8 }}>Only the account owner can approve.</p>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {past.length > 0 && (
        <section className="ap-card" style={{ marginTop: 20 }}>
          <h2 style={{ marginBottom: 12 }}>Recent decisions</h2>
          <div className="ap-table-wrap">
            <table className="ap-table">
              <thead>
                <tr><th>Action</th><th>Dispute</th><th>Result</th><th>Created</th></tr>
              </thead>
              <tbody>
                {past.map(({ dispute, action }) => {
                  const p = pastLabel(action);
                  return (
                    <tr key={action.id}>
                      <td>{actionTitle(action.action_type)}</td>
                      <td>#{dispute.paypalDisputeId}</td>
                      <td><Pill tone={p.tone}>{p.text}</Pill></td>
                      <td className="ap-cell-sub">{formatDate(action.created_at, true)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
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