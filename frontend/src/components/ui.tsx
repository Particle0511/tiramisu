import type { ReactNode } from "react";
import type { Tone } from "../lib/labels";

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="ap-loading" role="status">
      <span className="ap-dot" />
      {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="ap-error" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button className="ap-btn ghost sm" onClick={() => void onRetry()}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={"ap-pill " + tone}>{children}</span>;
}

export function Bar({ percent }: { percent: number }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className="ap-bar" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${p}%` }} />
    </div>
  );
}