import "dotenv/config";

const API = "http://localhost:4000";
const SUPA = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
const A = { email: process.env.TEST_EMAIL!, password: process.env.TEST_PASSWORD! };
const B = { email: process.env.TEST_EMAIL2!, password: process.env.TEST_PASSWORD2! };

if (!A.email || !A.password || !B.email || !B.password) {
  console.error("Set TEST_EMAIL, TEST_PASSWORD, TEST_EMAIL2, TEST_PASSWORD2 first.");
  process.exit(1);
}

async function login(u: { email: string; password: string }): Promise<string> {
  const res = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify(u),
  });
  if (!res.ok) throw new Error(`Login failed for ${u.email} (status ${res.status})`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function call(path: string, token: string | null, method = "GET", body?: unknown) {
  const res = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

let failed = 0;
function check(label: string, pass: boolean, extra = "") {
  console.log(`${label} -> ${pass ? "PASS" : "FAIL"}${extra ? " (" + extra + ")" : ""}`);
  if (!pass) failed++;
}

async function main() {
  const ta = await login(A);
  const tb = await login(B);

  let r = await call("/api/me", null);
  check("1. no token is refused", r.status === 401, String(r.status));

  r = await call("/api/me", "not.a.real.token");
  check("2. fake token is refused", r.status === 401, String(r.status));

  r = await call("/api/me", ta);
  check("3. user A can sign in", r.status === 200 && r.json.role === "owner", String(r.status));

  r = await call("/api/demo/seed", ta, "POST");
  check("4. user A loads demo data", r.status === 200, String(r.status));

  r = await call("/api/disputes", ta);
  const list: any[] = r.json?.disputes ?? [];
  check("5. user A sees 3 disputes", list.length === 3, `${list.length} found`);

  r = await call("/api/disputes", tb);
  check("6. user B sees 0 disputes", r.status === 200 && (r.json?.disputes ?? []).length === 0);

  const target = list.find((d) => d.paypalDisputeId.startsWith("DEMO-INR-001"));
  if (!target) {
    console.log("Could not find user A's first demo dispute");
    process.exit(1);
  }

  r = await call(`/api/disputes/${target.id}`, tb);
  check("7. B cannot read A's dispute", r.status === 404, String(r.status));

  r = await call(`/api/disputes/${target.id}/draft`, tb, "POST");
  check("8. B cannot draft on A's dispute", r.status === 404, String(r.status));

  r = await call("/api/actions", tb, "POST", {
    disputeId: target.id, actionType: "REFUND", amountMinor: 1000, currency: "USD",
  });
  check("9. B cannot create an action on A's dispute", r.status === 404, String(r.status));

  r = await call("/api/actions", ta, "POST", {
    disputeId: target.id, actionType: "REFUND", amountMinor: 3000, currency: "USD",
  });
  const actionId = r.json?.id;
  check("10. A creates a pending action", r.status === 201 && !!actionId, String(r.status));

  r = await call(`/api/actions/${actionId}/approve`, tb, "POST", { password: B.password });
  check("11. B cannot approve A's action", r.status === 404, String(r.status));

  r = await call(`/api/actions/${actionId}/approve`, ta, "POST", { password: "wrong-password" });
  check("12. wrong password blocks approval", r.status === 403, String(r.status));

  r = await call(`/api/actions/${actionId}/approve`, ta, "POST", { password: A.password });
  check("13. correct password approves", r.status === 200 && r.json?.status === "executed", String(r.status));

  r = await call(`/api/actions/${actionId}/approve`, ta, "POST", { password: A.password });
  check("14. second approval is refused", r.status === 409, String(r.status));

  r = await call("/api/audit/verify", ta);
  check("15. A's audit chain is intact", r.status === 200 && r.json?.ok === true, `${r.json?.checked} entries`);

  console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) FAILED.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Auth test crashed:", e.message);
  process.exit(1);
});