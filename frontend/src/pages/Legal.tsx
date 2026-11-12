
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { LogoLockup } from "../components/LogoLockup";

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="legal">
      <Link to="/" style={{ textDecoration: "none" }}><LogoLockup /></Link>
      <h1>{title}</h1>
      <p className="muted">Hackathon project. Last updated 10 November 2026.</p>
      {children}
    </div>
  );
}

export function Terms() {
  return (
    <LegalPage title="Terms of Service">
      <h2>What this is</h2>
      <p>Tiramisu is a hackathon project that helps sellers prepare responses to PayPal disputes. It runs only against the PayPal Sandbox, with test accounts and fictional data. It is not approved for real money or real customers.</p>
      <h2>No guarantees</h2>
      <p>Tiramisu does not promise to win disputes and does not give legal or financial advice. Deadlines, fees and evidence lists are estimates from stated inputs. Check PayPal's own documentation before relying on them.</p>
      <h2>Your actions</h2>
      <p>Nothing is sent to PayPal until you approve the exact content. You are responsible for what you approve and for the accuracy of any information you provide, such as a tracking number.</p>
      <h2>Acceptable use</h2>
      <p>Do not use the service to submit false information, to attack the service, or to access another seller's data.</p>
      <h2>Changes and availability</h2>
      <p>The service is provided as is, without warranty, and may change or stop at any time.</p>
    </LegalPage>
  );
}

export function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <h2>What we store</h2>
      <p>Your email address, your sandbox dispute and order records, messages in those disputes, drafts, approvals and an audit history of actions.</p>
      <h2>Who processes data</h2>
      <ul>
        <li>Supabase hosts the database and sign-in.</li>
        <li>PayPal Sandbox provides the dispute and order data.</li>
        <li>An AI model provider receives the facts used to draft a response. Use fictional data only.</li>
      </ul>
      <h2>Isolation</h2>
      <p>Each seller's data is separated from every other seller's data, in the application and in the database.</p>
      <h2>Your choices</h2>
      <p>You can ask for your data to be deleted by contacting the project owner. Do not enter real customer or payment data in this build.</p>
    </LegalPage>
  );
}
