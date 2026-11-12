import { LogoLockup } from "./LogoLockup";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";


export function AuthLayout({
  art,
  headline,
  children,
}: {
  art: "shield" | "arch";
  headline: string;
  children: ReactNode;
}) {
  return (
    <div className="au-page">
      <section className="au-form-side">
        <div className="au-inner">
          <Link to="/" className="au-brand" aria-label="Tiramisu home">
          <LogoLockup />
          </Link>
          <div className="au-body">
            <div className="au-card">{children}</div>
          </div>
          <p className="au-legal">
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
          </p>
        </div>
      </section>

      <section className="au-art">
        <img className="au-waves" src="/assets/3d/golden-waves.webp" alt="" />
        <div className="au-glow" />
        <div className="au-art-copy">
          <h2>{headline}</h2>
          <p className="au-lede">
            Nothing is sent to PayPal until you approve the exact text. This build runs on the PayPal Sandbox only.
          </p>
        </div>
        <div className={"au-stage one" + (art === "arch" ? " orb" : "")}>
  {art === "shield" ? (
    <img className="au-piece" src="/assets/3d/protection-shield.webp" alt="" />
  ) : (
    <img className="au-piece" src="/assets/3d/glass-orb.webp" alt="" />
  )}
</div>
      </section>
    </div>
  );
}