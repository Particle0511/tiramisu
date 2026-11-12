import { useEffect, useState, type FormEvent } from "react";
import { approveAction, rejectAction } from "../lib/queries";
import { formatDate } from "../lib/format";

export type ModalAction = {
  id: string;
  title: string;
  lines: [string, string][];
  message?: string;
  expiresAt?: string;
};

export function ApprovalModal({
  action,
  onClose,
}: {
  action: ModalAction;
  onClose: (changed: boolean) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose(outcome !== null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, outcome, onClose]);

  async function approve(e: FormEvent) {
    e.preventDefault();
    if (busy || !confirmed || !password) return;
    setBusy("approve");
    setError(null);
    try {
           const r = await approveAction(action.id, password);
      const simulated =
        typeof r.result === "object" && r.result !== null && (r.result as { simulated?: unknown }).simulated === true;
      setOutcome(
        r.status === "executed"
          ? {
              ok: true,
              text: simulated
                ? "Done. This is a demo dispute, so nothing was sent to PayPal."
                : "Done. Your approved action was sent to the PayPal Sandbox.",
            }
          : { ok: false, text: r.error ?? "PayPal did not accept this action." }
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    if (busy) return;
    setBusy("reject");
    setError(null);
    try {
      await rejectAction(action.id);
      setOutcome({ ok: true, text: "Rejected. Nothing was sent." });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="ap-modal-back"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose(outcome !== null);
      }}
    >
      <div className="ap-modal" role="dialog" aria-modal="true" aria-labelledby="ap-modal-title">
        <h2 id="ap-modal-title">{action.title}</h2>

        {outcome ? (
          <>
            <p className={outcome.ok ? "ap-notice" : "ap-error-text"} role="status" style={{ marginTop: 20 }}>
              {outcome.text}
            </p>
            <div className="ap-modal-actions">
              <button className="ap-btn dark" onClick={() => onClose(true)}>
                Close
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={approve}>
            {action.lines.length > 0 && (
              <dl className="ap-dl" style={{ marginTop: 18 }}>
                {action.lines.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            )}
            {action.message && (
              <>
                <p className="ap-label" style={{ marginTop: 18 }}>
                  Exact text that will be sent
                </p>
                <pre className="ap-message">{action.message}</pre>
              </>
            )}
            {action.expiresAt && (
              <p className="ap-sub" style={{ marginTop: 10 }}>
                This request expires on {formatDate(action.expiresAt, true)}.
              </p>
            )}

            <div className="ap-field" style={{ marginTop: 20 }}>
              <label htmlFor="ap-pw">Confirm with your password</label>
              <input
                id="ap-pw"
                className="ap-input"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <label className="ap-check">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              <span>I confirm this action is correct.</span>
            </label>
            {error && (
              <p className="ap-error-text" role="alert">
                {error}
              </p>
            )}
            <div className="ap-modal-actions">
              <button type="button" className="ap-btn ghost" onClick={() => void reject()} disabled={busy !== null}>
                {busy === "reject" ? "Rejecting" : "Reject"}
              </button>
              <button type="button" className="ap-btn ghost" onClick={() => onClose(false)} disabled={busy !== null}>
                Decide later
              </button>
              <button className="ap-btn dark" type="submit" disabled={!confirmed || !password || busy !== null}>
                {busy === "approve" ? "Approving" : "Approve and send"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}