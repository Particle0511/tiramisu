import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, sep } from "path";

const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name.endsWith(".ts")) out.push(full);
  }
  return out;
}

const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");
const rel = (f: string) => relative(SRC, f).split(sep).join("/");


const CLI =
  /(^|[\\/])(test[A-Z]\w*|\w+Test|\w+Cli|ping|check|makeTestPayment|listDisputes|getDispute)\.ts$/;

const allFiles = walk(SRC);
const runtimeFiles = allFiles.filter((f) => !CLI.test(f));

describe("security guards on the source code", () => {
  it("no file mentions a service_role or secret key", () => {
    const hits = allFiles.filter((f) =>
      /service_role|sb_secret_/i.test(readFileSync(f, "utf8"))
    );
    expect(hits.map(rel)).toEqual([]);
  });

  it("no runtime code edits, deletes or truncates the audit log", () => {
    const hits = runtimeFiles.filter((f) =>
      /update\s+audit_log|delete\s+from\s+audit_log|truncate\s+audit_log/i.test(
        readFileSync(f, "utf8")
      )
    );
    expect(hits.map(rel)).toEqual([]);
  });

  it("login is applied before any API route is registered", () => {
    const api = read("routes/api.ts");
    const authAt = api.indexOf("apiRouter.use(requireAuth)");
    const firstRoute = api.search(/apiRouter\.(get|post|put|patch|delete)\(/);
    expect(authAt).toBeGreaterThan(-1);
    expect(authAt).toBeLessThan(firstRoute);
  });

  it("every state-changing API route needs the owner role and a rate limit", () => {
    const api = read("routes/api.ts");
    const marks = [...api.matchAll(/apiRouter\.(get|post|put|patch|delete)\(/g)];
    const writes = marks
      .map((m, i) => ({
        method: m[1],
        text: api.slice(m.index!, marks[i + 1]?.index ?? api.length),
      }))
      .filter((c) => c.method !== "get");

    expect(writes.length).toBeGreaterThan(0);
    for (const w of writes) {
      expect(w.text).toContain("requireOwner");
      expect(w.text).toMatch(/Limiter/);
    }
  });

  it("the webhook route verifies the signature before storing anything", () => {
    const wh = read("routes/webhooks.ts");
    const verifyAt = wh.indexOf("verifyWebhookSignature(");
    const insertAt = wh.indexOf("insert into webhook_events");
    expect(verifyAt).toBeGreaterThan(-1);
    expect(insertAt).toBeGreaterThan(-1);
    expect(verifyAt).toBeLessThan(insertAt);
  });

  it("only the gate and the approve route can run an approved action", () => {
    const callers = runtimeFiles
      .filter((f) => readFileSync(f, "utf8").includes("approveAction("))
      .map(rel)
      .sort();
    expect(callers).toEqual(["actions/gate.ts", "routes/api.ts"]);
  });
});