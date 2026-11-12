import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { AuthLayout } from "../components/AuthLayout";
import { PasswordInput } from "../components/PasswordInput";

const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);


function strength(pw: string): { score: number; label: string } {
  if (!pw) return { score: 0, label: "" };
  if (pw.length < 10) return { score: 1, label: "Too short" };
  let score = 2;
  if (pw.length >= 14) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return { score, label: ["", "", "Okay", "Good", "Strong"][score] };
}

export default function Signup() {
  const { session, loading, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const st = strength(password);

  if (!loading && session) return <Navigate to="/overview" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (password.length < 10) return setError("Use a password of at least 10 characters.");
    if (password !== confirm) return setError("The two passwords do not match.");
    if (!agree) return setError("Accept the Terms of Service and Privacy Policy to continue.");

    setBusy(true);
    const r = await signUp(email, password);
    setBusy(false);
    if (r.error) return setError(r.error);
    if (r.needsConfirmation) setDone(true);
    
  }

  return (
    <AuthLayout art="arch" headline="Every response backed by a real record.">
      <h1 className="au-title">Create your account</h1>
      <p className="au-sub">Use an email you can access.</p>

      {done ? (
        <p className="au-notice" role="status">
          Check your email to confirm the account, then <Link to="/login">sign in</Link>.
        </p>
      ) : (
        <form className="au-form" onSubmit={onSubmit} noValidate>
          <div className="au-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="au-input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="au-field">
            <label htmlFor="password">Password</label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              placeholder="At least 10 characters"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="au-meter" data-score={st.score} aria-hidden="true">
              {[1, 2, 3, 4].map((i) => (
                <span key={i} className={i <= st.score ? "on" : ""} />
              ))}
            </div>
            <p className="au-hint" aria-live="polite">
              {st.label || "At least 10 characters."}
            </p>
          </div>
          <div className="au-field">
            <label htmlFor="confirm">Confirm password</label>
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              placeholder="Repeat your password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <label className="au-check">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>
              I agree to the <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link>.
            </span>
          </label>
          {error && (
            <p className="au-alert" role="alert">
              {error}
            </p>
          )}
          <button className="au-btn" type="submit" disabled={busy || !email || !password || !confirm}>
            {busy ? (
              <>
                <span className="au-spin" aria-hidden="true" />
                Creating account
              </>
            ) : (
              <>
                Create account
                <Arrow />
              </>
            )}
          </button>
        </form>
      )}

      <p className="au-alt">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}