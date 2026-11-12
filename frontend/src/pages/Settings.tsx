import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useAsync } from "../lib/useAsync";
import { getMe, getSettings, putSettings } from "../lib/queries";
import { formatDate } from "../lib/format";
import { Bar, ErrorBox, Loading, Pill } from "../components/ui";
import { PaypalConnectionCard } from "../components/PaypalConnectionCard";

// "50.00" to 5000. Returns null when the text is not a valid amount.
function toMinor(input: string, digits: number): number | null {
  const t = input.trim();
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  if (frac.length > digits) return null;
  const fracMinor = digits === 0 ? 0 : Number((frac + "0".repeat(digits)).slice(0, digits));
  return Number(whole) * 10 ** digits + fracMinor;
}

const SAFEGUARDS = [
  "Nothing is sent to PayPal until you approve the exact text.",
  "Every approval and every limit change asks for your password again.",
  "Buyer messages that try to give the AI instructions are flagged and kept away from it.",
  "Every AI statement must link to a real record, or it is removed.",
  "Your PayPal secret is stored encrypted and is never shown again.",
];

export default function Settings() {
  const { signOut } = useAuth();
  const me = useAsync(getMe);
  const q = useAsync(getSettings);
  const [value, setValue] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const isOwner = me.data?.role === "owner";

  if (q.loading && !q.data) return <Loading label="Loading settings" />;
  if (q.error && !q.data) return <ErrorBox message={q.error} onRetry={q.reload} />;
  if (!q.data) return null;

  const s = q.data;
  const digits = s.maxRefundFormatted.includes(".") ? s.maxRefundFormatted.split(".")[1].length : 0;
  const shown = value ?? s.maxRefundFormatted;
  const usedPercent = s.ceilingMinor ? (s.maxRefundMinor / s.ceilingMinor) * 100 : 0;

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setMsg(null);
    const minor = toMinor(shown, digits);
    if (minor === null) return setMsg({ ok: false, text: `Enter an amount like ${s.maxRefundFormatted}.` });
    if (minor > s.ceilingMinor) {
      return setMsg({ ok: false, text: `The limit cannot be above ${s.ceilingFormatted} ${s.currency}.` });
    }
    if (!password) return setMsg({ ok: false, text: "Enter your password to confirm the change." });
    setBusy(true);
    try {
      const r = await putSettings({ maxRefundMinor: minor, password });
      setValue(null);
      setPassword("");
      await q.reload();
      setMsg({ ok: true, text: r.changed ? "Refund limit updated." : "That is already your limit. Nothing changed." });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="ap-head">
        <div>
          <h1>Settings</h1>
          <p className="ap-sub">Your account, your PayPal connection, and the limits that protect your money.</p>
        </div>
      </div>

      <div className="ap-split">
        <div className="ap-stack">
          <section className="ap-card">
            <div className="ap-row-head">
              <h2>Your account</h2>
              <Pill tone={isOwner ? "ok" : "neutral"}>{isOwner ? "Owner" : "Viewer"}</Pill>
            </div>
            <dl className="ap-dl">
              <div><dt>Email</dt><dd>{me.data?.email ?? "..."}</dd></div>
              <div><dt>Access</dt><dd>{isOwner ? "Can approve and change settings" : "Read-only"}</dd></div>
              <div><dt>Workspace</dt><dd>{me.data ? me.data.tenantId.slice(0, 8) : "..."}</dd></div>
              <div><dt>Rules last checked</dt><dd>{me.data ? formatDate(me.data.rulesLastChecked) : "..."}</dd></div>
            </dl>
            <button className="ap-btn ghost" style={{ marginTop: 18 }} onClick={() => void signOut()}>
              Sign out
            </button>
          </section>

          <PaypalConnectionCard isOwner={isOwner} />
        </div>

        <div className="ap-stack">
          <section className="ap-card">
            <h2>Refund limit</h2>
            <p className="ap-sub" style={{ marginBottom: 16 }}>
              When you approve a refund, Tiramisu checks it against this limit. A refund above it is blocked, even if you
              approve it.
            </p>
            <p className="ap-limit-big">
              {s.maxRefundFormatted} <span className="ap-cur">{s.currency}</span>
            </p>
            <Bar percent={usedPercent} />
            <p className="ap-cell-sub" style={{ marginTop: 6 }}>
              Maximum you can set: {s.ceilingFormatted} {s.currency}
            </p>

            {isOwner ? (
              <form onSubmit={onSave} className="ap-form">
                <div className="ap-field">
                  <label htmlFor="limit">New limit</label>
                  <div className="ap-input-row">
                    <input id="limit" className="ap-input" inputMode="decimal" value={shown} onChange={(e) => setValue(e.target.value)} />
                    <span className="ap-cur">{s.currency}</span>
                  </div>
                </div>
                <div className="ap-field">
                  <label htmlFor="pw">Confirm with your password</label>
                  <input id="pw" className="ap-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                {msg && (
                  <p className={msg.ok ? "ap-notice" : "ap-error-text"} role={msg.ok ? "status" : "alert"}>
                    {msg.text}
                  </p>
                )}
                <button className="ap-btn dark" type="submit" disabled={busy}>
                  {busy ? "Saving" : "Save limit"}
                </button>
              </form>
            ) : (
              <p className="ap-sub" style={{ marginTop: 14 }}>Only the account owner can change this.</p>
            )}
          </section>

          <section className="ap-card">
            <h2 style={{ marginBottom: 6 }}>Built-in safeguards</h2>
            <p className="ap-sub" style={{ marginBottom: 8 }}>These are always on. You cannot switch them off.</p>
            <ul className="ap-safe">
              {SAFEGUARDS.map((t) => (
                <li key={t}>
                  <span className="ap-tick" aria-hidden="true">✓</span>
                  <span>{t}</span>
                </li>
              ))}
              <li>
                <span className="ap-tick" aria-hidden="true">✓</span>
                <span>
                  Every action is saved in a tamper-evident history. <Link to="/activity" className="ap-link">See Activity</Link>
                </span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}