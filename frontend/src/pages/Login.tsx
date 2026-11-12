import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { AuthLayout } from "../components/AuthLayout";
import { PasswordInput } from "../components/PasswordInput";

const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);

export default function Login() {
  const { session, loading, signIn } = useAuth();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from ?? "/overview";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && session) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const err = await signIn(email, password);
    if (err) setError(err);
    setBusy(false);
  }

  return (
    <AuthLayout art="shield" headline="Smarter protection. Stronger business.">
      <h1 className="au-title">Welcome back</h1>
      <p className="au-sub">Sign in to access your seller dashboard.</p>

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
            autoComplete="current-password"
            placeholder="Enter your password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p className="au-alert" role="alert">
            {error}
          </p>
        )}
        <button className="au-btn" type="submit" disabled={busy || !email || !password}>
          {busy ? (
            <>
              <span className="au-spin" aria-hidden="true" />
              Signing in
            </>
          ) : (
            <>
              Sign in
              <Arrow />
            </>
          )}
        </button>
      </form>

      <p className="au-alt">
        New to Tiramisu? <Link to="/signup">Create an account</Link>
      </p>
    </AuthLayout>
  );
}