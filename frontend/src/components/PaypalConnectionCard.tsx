import { useState, type FormEvent } from "react";
import { ApiError } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { deletePaypalConnection, getPaypalConnection, putPaypalConnection, seedDemo } from "../lib/queries";
import { runSync } from "../lib/paypalSync";
import { formatDate } from "../lib/format";
import { ErrorBox, Loading, Pill } from "./ui";

type FieldErrors = { keys?: string; password?: string; general?: string };

function mapError(e: unknown): FieldErrors {
  if (e instanceof ApiError) {
    if (e.status === 400) return { keys: e.message };
    if (e.status === 409) return { keys: "These keys are already used by another workspace." };
    if (e.status === 403) return { password: "That password is not correct." };
    if (e.status === 429) return { general: "Too many attempts. Wait a minute and try again." };
    if (e.status === 503) return { general: "Connecting a PayPal account is not available on this server." };
    return { general: e.message };
  }
  return { general: (e as Error).message };
}

function clearSecrets(form: HTMLFormElement) {
  for (const name of ["clientSecret", "password"]) {
    const el = form.elements.namedItem(name);
    if (el instanceof HTMLInputElement) el.value = "";
  }
}

export function PaypalConnectionCard({ isOwner }: { isOwner: boolean }) {
  const q = useAsync(getPaypalConnection);
  const [busy, setBusy] = useState<"connect" | "disconnect" | "sync" | "seed" | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [dError, setDError] = useState<string | null>(null);

  if (q.loading && !q.data) {
    return (
      <section className="ap-card">
        <Loading label="Checking PayPal connection" />
      </section>
    );
  }
  if (q.error && !q.data) {
    return (
      <section className="ap-card">
        <ErrorBox message={q.error} onRetry={q.reload} />
      </section>
    );
  }
  if (!q.data) return null;
  const c = q.data;

  async function onConnect(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const clientId = String(data.get("clientId") ?? "").trim();
    const clientSecret = String(data.get("clientSecret") ?? "").trim();
    const password = String(data.get("password") ?? "");
    setMsg(null);
    if (!clientId || !clientSecret) return setErrors({ keys: "Enter both the Client ID and the Client Secret." });
    if (!password) return setErrors({ password: "Enter your account password to confirm." });

    clearSecrets(form); // the secret and password leave the page right away
    setErrors({});
    setBusy("connect");
    try {
      await putPaypalConnection({ clientId, clientSecret, password });
      form.reset();
      await q.reload();
      setMsg({ ok: true, text: "Connected. PayPal accepted your Sandbox keys." });
    } catch (err) {
      setErrors(mapError(err));
    } finally {
      setBusy(null);
    }
  }

  async function onDisconnect(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const password = String(new FormData(form).get("password") ?? "");
    if (!password) return setDError("Enter your account password to confirm.");
    clearSecrets(form);
    setDError(null);
    setBusy("disconnect");
    try {
      await deletePaypalConnection(password);
      setConfirming(false);
      await q.reload();
      setMsg({ ok: true, text: "Disconnected. Sync and approved PayPal actions are off until you connect again." });
    } catch (err) {
      const m = mapError(err);
      setDError(m.password ?? m.general ?? m.keys ?? "Could not disconnect.");
    } finally {
      setBusy(null);
    }
  }

  async function onSync() {
    setBusy("sync");
    setMsg(null);
    const r = await runSync();
    await q.reload();
    setMsg({ ok: r.ok, text: r.text });
    setBusy(null);
  }

  async function onSeed() {
    setBusy("seed");
    setMsg(null);
    try {
      await seedDemo();
      setMsg({ ok: true, text: "Demo disputes loaded. Open Overview to see them." });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const pill =
    c.status === "connected" ? (
      <Pill tone="ok">Connected</Pill>
    ) : c.status === "invalid" ? (
      <Pill tone="crit">Keys rejected</Pill>
    ) : (
      <Pill tone="neutral">Not connected</Pill>
    );
  const sourceText =
    c.source === "tenant"
      ? "Using your own Sandbox keys."
      : c.source === "env"
      ? "Connected with the project's own Sandbox keys."
      : "Nothing is connected yet.";
  const formTitle =
    c.source === "tenant" ? "Replace your keys" : c.source === "env" ? "Connect your own keys instead" : "Connect your Sandbox app";

  return (
    <section className="ap-card">
      <div className="ap-row-head">
        <h2>PayPal connection</h2>
        <Pill tone="warn">Sandbox</Pill>
      </div>
      <p className="ap-sub" style={{ marginBottom: 16 }}>
        This is the PayPal Sandbox with test money. It is not a live PayPal account.
      </p>

      <dl className="ap-dl">
        <div><dt>Status</dt><dd>{pill}</dd></div>
        <div><dt>Client ID</dt><dd>{c.clientIdMasked ?? "None"}</dd></div>
        <div><dt>Last verified</dt><dd>{c.lastVerifiedAt ? formatDate(c.lastVerifiedAt, true) : "Never"}</dd></div>
        <div><dt>Last sync</dt><dd>{c.lastSyncAt ? formatDate(c.lastSyncAt, true) : "Never"}</dd></div>
      </dl>
      <p className="ap-sub" style={{ marginTop: 12 }}>
        {sourceText}
        {c.status === "invalid" && " PayPal rejected the saved keys. Reconnect below."}
      </p>

      {msg && (
        <p className={msg.ok ? "ap-notice" : "ap-notice warn"} role="status" style={{ marginTop: 14 }}>
          {msg.text}
        </p>
      )}

      {isOwner && (
        <div className="ap-actions" style={{ marginTop: 16 }}>
          {c.connected && (
            <button className="ap-btn dark" onClick={() => void onSync()} disabled={busy !== null}>
              {busy === "sync" ? "Syncing" : "Sync from PayPal"}
            </button>
          )}
          {c.source === "tenant" && (
            <button className="ap-btn ghost" onClick={() => setConfirming(true)} disabled={busy !== null}>
              Disconnect
            </button>
          )}
        </div>
      )}

      {!c.canConnect && (
        <p className="ap-notice" style={{ marginTop: 16 }}>
          Connecting a PayPal account is not available on this server.
        </p>
      )}
      {!isOwner && <p className="ap-sub" style={{ marginTop: 16 }}>Only the account owner can connect or change keys.</p>}

      {isOwner && c.canConnect && (
        <>
          <div className="ap-divider" />
          <h3 style={{ marginBottom: 12 }}>{formTitle}</h3>
          <form onSubmit={onConnect} className="ap-form" style={{ marginTop: 0 }} autoComplete="off">
            <div className="ap-field">
              <label htmlFor="pp-id">Client ID</label>
              <input id="pp-id" name="clientId" className="ap-input" autoComplete="off" spellCheck={false} />
            </div>
            <div className="ap-field">
              <label htmlFor="pp-secret">Client Secret</label>
              <input id="pp-secret" name="clientSecret" className="ap-input" type="password" autoComplete="new-password" spellCheck={false} />
              {errors.keys && <p className="ap-error-text" role="alert">{errors.keys}</p>}
            </div>
            <div className="ap-field">
              <label htmlFor="pp-pw">Your account password</label>
              <input id="pp-pw" name="password" className="ap-input" type="password" autoComplete="current-password" />
              {errors.password && <p className="ap-error-text" role="alert">{errors.password}</p>}
            </div>
            {errors.general && <p className="ap-error-text" role="alert">{errors.general}</p>}
            <button className="ap-btn dark" type="submit" disabled={busy !== null}>
              {busy === "connect" ? "Checking with PayPal" : "Connect"}
            </button>
          </form>
        </>
      )}

      <details className="ap-guide">
        <summary>How to get your Sandbox keys</summary>
        <ol>
          <li>Open <a href="https://developer.paypal.com" target="_blank" rel="noopener noreferrer">developer.paypal.com</a> and sign in.</li>
          <li>Switch to Sandbox at the top of the dashboard.</li>
          <li>Open Apps and Credentials and choose Create App. Pick the Merchant type.</li>
          <li>Copy the Client ID and the Secret from the new app.</li>
          <li>To see disputes, create a sandbox buyer and seller, make a payment from the buyer, and open an item-not-received dispute as the buyer.</li>
        </ol>
      </details>

      {isOwner && (
        <>
          <div className="ap-divider" />
          <p className="ap-sub">No PayPal account to test with? Load three fictional disputes to try every screen.</p>
          <button className="ap-btn ghost" style={{ marginTop: 10 }} onClick={() => void onSeed()} disabled={busy !== null}>
            {busy === "seed" ? "Loading" : "Load demo data"}
          </button>
        </>
      )}

      {confirming && (
        <div
          className="ap-modal-back"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && busy !== "disconnect") setConfirming(false);
          }}
        >
          <div className="ap-modal" role="dialog" aria-modal="true" aria-labelledby="dc-title">
            <h2 id="dc-title">Disconnect PayPal?</h2>
            <p className="ap-sub" style={{ marginTop: 10 }}>
              Sync and approved PayPal actions stop working for this workspace until you connect again.
            </p>
            <form onSubmit={onDisconnect}>
              <div className="ap-field" style={{ marginTop: 18 }}>
                <label htmlFor="dc-pw">Confirm with your account password</label>
                <input id="dc-pw" name="password" className="ap-input" type="password" autoComplete="current-password" autoFocus />
              </div>
              {dError && <p className="ap-error-text" role="alert">{dError}</p>}
              <div className="ap-modal-actions">
                <button type="button" className="ap-btn ghost" onClick={() => setConfirming(false)} disabled={busy === "disconnect"}>
                  Cancel
                </button>
                <button className="ap-btn dark" type="submit" disabled={busy === "disconnect"}>
                  {busy === "disconnect" ? "Disconnecting" : "Disconnect"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}