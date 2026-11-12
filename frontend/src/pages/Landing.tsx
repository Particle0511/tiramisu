import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { LogoLockup } from "../components/LogoLockup";

const d = (s: number) => ({ "--d": `${s}s` }) as CSSProperties;

const MANIFESTO =
  "Every statement in a response has to link to a real record. A statement that cannot is removed before you see it. Nothing is sent until you approve it.";
const WORDS = MANIFESTO.split(" ");

const STORY = [
  {
    img: "delivery-package",
    title: "Bring in every dispute",
    text: "Sync from the PayPal Sandbox. Orders, payments, tracking details and buyer messages become records you can point to.",
  },
  {
    img: "evidence-document",
    title: "Draft only from evidence",
    text: "The AI writes from your records. A statement that no record supports is removed before you see it.",
  },
  {
    img: "approval-lock",
    title: "Approve every word",
    text: "Nothing reaches PayPal until you read the exact text and confirm with your password.",
  },
];


type Item = { key: string; label: string; required: boolean };
const RULES: { id: string; name: string; items: Item[] }[] = [
  {
    id: "inr",
    name: "Item not received",
    items: [
      { key: "order", label: "Order details", required: true },
      { key: "payment", label: "Payment record", required: true },
      { key: "tracking", label: "Shipment tracking number", required: true },
      { key: "delivery", label: "Delivery confirmation", required: true },
      { key: "receipt", label: "Third-party shipping receipt", required: false },
      { key: "refund", label: "Proof of any refund already given", required: false },
      { key: "address", label: "Shipping address matches order", required: false },
      { key: "messages", label: "Buyer communication", required: false },
    ],
  },
  {
    id: "inad",
    name: "Item not as described",
    items: [
      { key: "order", label: "Order details", required: true },
      { key: "payment", label: "Payment record", required: true },
      { key: "listing", label: "Item listing or description", required: true },
      { key: "photos", label: "Photos of the item sent", required: false },
      { key: "policy", label: "Return or refund policy", required: false },
      { key: "messages", label: "Buyer communication", required: false },
    ],
  },
  {
    id: "unauth",
    name: "Unauthorized",
    items: [
      { key: "order", label: "Order details", required: true },
      { key: "payment", label: "Payment record", required: true },
      { key: "address", label: "Shipping address on the order", required: true },
      { key: "tracking", label: "Shipment tracking number", required: false },
      { key: "delivery", label: "Delivery confirmation", required: false },
      { key: "messages", label: "Buyer communication", required: false },
    ],
  },
  {
    id: "other",
    name: "Other",
    items: [
      { key: "order", label: "Order details", required: true },
      { key: "payment", label: "Payment record", required: true },
      { key: "messages", label: "Buyer communication", required: false },
    ],
  },
];

const FEATURES = [
  { title: "Prevention Radar", text: "Overdue deadlines, missing tracking numbers and thin evidence are flagged while there is still time to act." },
  { title: "Evidence Intelligence", text: "A checklist of the records each dispute type needs, with what was found and what is missing." },
  { title: "Approval Center", text: "Every action waits for your password. Nothing is sent on its own." },
  { title: "Refund limits", text: "You set the ceiling. A refund above it is blocked, even after you approve it." },
  { title: "Message screening", text: "Buyer messages that try to give the AI instructions are flagged and kept away from it." },
  { title: "Activity history", text: "Each action is chained to the one before it, and you can verify the chain at any time." },
];

function Checker() {
  const [type, setType] = useState(0);
  const [found, setFound] = useState<Record<string, boolean>>({});
  const rule = RULES[type];
  const required = rule.items.filter((i) => i.required);
  const have = required.filter((i) => found[i.key]).length;
  const pct = required.length ? Math.round((have / required.length) * 100) : 0;
  const missing = required.filter((i) => !found[i.key]);

  function pick(i: number) {
    setType(i);
    setFound({});
  }

  return (
    <div className="lp-check">
      <div>
        <div className="lp-seg" role="group" aria-label="Dispute type">
          {RULES.map((r, i) => (
            <button key={r.id} type="button" aria-pressed={type === i} className={type === i ? "on" : ""} onClick={() => pick(i)}>
              {r.name}
            </button>
          ))}
        </div>
        <ul className="lp-items">
          {rule.items.map((it) => (
            <li key={it.key}>
              <label>
                <input
                  type="checkbox"
                  checked={!!found[it.key]}
                  onChange={(e) => setFound({ ...found, [it.key]: e.target.checked })}
                />
                <span>{it.label}</span>
                <em>{it.required ? "Required" : "Optional"}</em>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="lp-result" aria-live="polite">
        <p className="lp-pct">
          {pct}
          <span>%</span>
        </p>
        <p className="lp-p" style={{ marginTop: 0 }}>of the required evidence found</p>
        <div className="lp-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${pct}%` }} />
        </div>
        {missing.length > 0 ? (
          <>
            <p className="lp-miss-h">Still missing</p>
            <ul className="lp-miss">
              {missing.map((m) => (
                <li key={m.key}>{m.label}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="lp-miss-h">Every required record is in place.</p>
        )}
        <p className="lp-fine">
          This is the share of required items found. It is not a chance of winning. The lists follow Tiramisu's working
          assumptions, so check PayPal's seller documentation.
        </p>
      </div>
    </div>
  );
}

export default function Landing() {
  const { session } = useAuth();
  const root = useRef<HTMLDivElement>(null);
  const story = useRef<HTMLDivElement>(null);
  const mani = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [lit, setLit] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? WORDS.length : 0
  );

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
    let raf = 0;
    let sraf = 0;
    let target = window.scrollY;
    let cur = target;


    const update = () => {
      const vh = window.innerHeight;
      const s = story.current;
      if (s && window.innerWidth > 900) {
        const i = Math.round(-s.getBoundingClientRect().top / vh);
        setActive(clamp(i, 0, STORY.length - 1));
      }
      const m = mani.current;
      if (m && !reduce) {
        const range = m.offsetHeight - vh;
        const p = range > 0 ? clamp(-m.getBoundingClientRect().top / range, 0, 1) : 1;
        setLit(Math.ceil(clamp(p / 0.85, 0, 1) * WORDS.length));
      }
    };


    const smooth = () => {
      cur += (target - cur) * 0.09;
      if (Math.abs(target - cur) < 0.1) cur = target;
      el.style.setProperty("--sm", cur.toFixed(1));
      sraf = cur === target ? 0 : requestAnimationFrame(smooth);
    };

    const onScroll = () => {
      target = window.scrollY;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
      if (!reduce && !sraf) sraf = requestAnimationFrame(smooth);
    };

    update();
    if (!reduce) el.style.setProperty("--sm", String(cur));
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    const items = el.querySelectorAll<HTMLElement>(".lp-reveal");
    let io: IntersectionObserver | null = null;
    if (reduce || !("IntersectionObserver" in window)) {
      items.forEach((i) => i.classList.add("in"));
    } else {
      io = new IntersectionObserver(
        (entries) =>
          entries.forEach((en) => {
            if (en.isIntersecting) {
              en.target.classList.add("in");
              io?.unobserve(en.target);
            }
          }),
        { threshold: 0.12 }
      );
      items.forEach((i) => io?.observe(i));
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
      cancelAnimationFrame(sraf);
      io?.disconnect();
    };
  }, []);

  return (
    <div className="lp" ref={root}>
      <header className="lp-nav">
        <div className="lp-wrap">
          <Link to="/" aria-label="Tiramisu home" className="lockup-link">
            <LogoLockup light />
          </Link>
          <nav className="lp-links" aria-label="Page sections">
            <a href="#story">How it works</a>
            <a href="#check">Evidence checker</a>
            <a href="#features">What it does</a>
          </nav>
          <div className="lp-cta">
            {session ? (
              <Link className="lp-btn gold" to="/overview">Open dashboard</Link>
            ) : (
              <>
                <Link className="lp-btn outline lp-hide-sm" to="/login">Sign in</Link>
                <Link className="lp-btn gold" to="/signup">Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-wrap lp-hero-grid">
          <div className="lp-par-a">
            <h1 className="lp-h1 lp-up" style={d(0)}>
              Answer PayPal disputes with <span className="gold">proof.</span>
            </h1>
            <p className="lp-lede lp-up" style={d(0.12)}>
              Tiramisu watches your disputes, builds each response from your own records, and sends nothing until you
              approve every word.
            </p>
            <div className="lp-actions lp-up" style={d(0.24)}>
              {session ? (
                <Link className="lp-btn gold big" to="/overview">Open dashboard</Link>
              ) : (
                <Link className="lp-btn gold big" to="/signup">Get started</Link>
              )}
              <a className="lp-btn outline big" href="#story">See how it works</a>
            </div>
            <p className="lp-small lp-up" style={d(0.36)}>Runs on the PayPal Sandbox with test data only.</p>
          </div>

          <div className="lp-orbit" aria-hidden="true">
            <div className="lp-orbit-scroll">
              <div className="lp-orbit-spin">
                <img src="/assets/3d/orbital-rings.webp" alt="" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-sec" id="story">
        <div className="lp-wrap">
          <div className="lp-reveal">
            <h2 className="lp-h2">Three steps, and you hold the last one.</h2>
            <p className="lp-p">The AI drafts. You decide what is sent.</p>
          </div>

          <div className="lp-story" ref={story}>
            <div>
              {STORY.map((s, i) => (
                <article key={s.title} className={"lp-sstep" + (active === i ? " on" : "")}>
                  <img className="m-img" src={`/assets/3d/${s.img}.webp`} alt="" />
                  <span className="n">0{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p className="lp-p">{s.text}</p>
                </article>
              ))}
            </div>
            <div className="lp-sticky" aria-hidden="true">
              <div className="lp-visual">
                {STORY.map((s, i) => (
                  <img key={s.img} className={active === i ? "on" : ""} src={`/assets/3d/${s.img}.webp`} alt="" />
                ))}
                <p className="lp-count">0{active + 1} of 03</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-mani" ref={mani} aria-label="Our rule">
        <div className="lp-mani-in">
          <div className="lp-wrap">
            <p className="lp-mani-text">
              {WORDS.map((w, i) => (
                <span key={i} className={i < lit ? "w on" : "w"}>
                  {w}{" "}
                </span>
              ))}
            </p>
          </div>
        </div>
      </section>

      <section className="lp-sec lp-alt" id="check">
        <div className="lp-wrap">
          <div className="lp-reveal">
            <h2 className="lp-h2">Check your evidence against the rules.</h2>
            <p className="lp-p">Pick a dispute type and tick the records you have. Nothing here is saved or sent.</p>
          </div>
          <Checker />
        </div>
      </section>

      <section className="lp-sec" id="features">
        <div className="lp-wrap lp-two">
          <div className="lp-reveal">
            <h2 className="lp-h2">What it does</h2>
            <p className="lp-p">Six controls, each built to keep you in charge of what is sent.</p>
          </div>
          <div className="lp-rows">
            {FEATURES.map((f, i) => (
              <div className="lp-row lp-reveal" key={f.title}>
                <span className="n">0{i + 1}</span>
                <div>
                  <h3>{f.title}</h3>
                  <p className="lp-p">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-end">
        <div className="lp-wrap">
          <h2 className="lp-h2 lp-reveal">Respond with proof.</h2>
          <p className="lp-p lp-reveal" style={d(0.1)}>
            Create an account and load three demo disputes in one click to try every screen. This is a hackathon project
            on the PayPal Sandbox, with test accounts and test money only.
          </p>
          <div className="lp-actions lp-reveal" style={d(0.2)}>
            {session ? (
              <Link className="lp-btn dark big" to="/overview">Open dashboard</Link>
            ) : (
              <>
                <Link className="lp-btn dark big" to="/signup">Create an account</Link>
                <Link className="lp-btn line-dark big" to="/login">Sign in</Link>
              </>
            )}
          </div>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="lp-wrap">
          <Link to="/" aria-label="Tiramisu home" className="lockup-link">
            <LogoLockup light small />
          </Link>
          <p>Hackathon project. Runs on the PayPal Sandbox with test data only.</p>
          <p>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}