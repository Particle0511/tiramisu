
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { LogoLockup } from "./LogoLockup";
import { Icon, type IconName } from "./icon";

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: "/overview", label: "Overview", icon: "overview" },
  { to: "/disputes", label: "Disputes", icon: "disputes" },
  { to: "/prevention", label: "Prevention Radar", icon: "radar" },
  { to: "/evidence", label: "Evidence Intelligence", icon: "evidence" },
  { to: "/approvals", label: "Approval Center", icon: "approvals" },
  { to: "/activity", label: "Activity", icon: "activity" },
  { to: "/settings", label: "Settings", icon: "settings" },
];

export default function Shell() {
  const { email, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="shell">
      <aside id="sidebar" className={"sidebar on-dark" + (open ? " open" : "")}>
        <Link to="/" className="lockup-link" aria-label="Tiramisu home">
          <LogoLockup light small />
        </Link>
        <nav aria-label="Primary">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
              onClick={() => setOpen(false)}
            >
              <Icon name={n.icon} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="account">
          <div className="account-email" title={email ?? ""}>
            {email}
          </div>
          <button className="btn btn-ghost-dark btn-block" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button
            className="btn menu-btn"
            aria-expanded={open}
            aria-controls="sidebar"
            onClick={() => setOpen((v) => !v)}
          >
            Menu
          </button>
          <span className="status neutral">PayPal Sandbox</span>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
