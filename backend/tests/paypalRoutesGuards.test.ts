import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const read = (rel: string) => readFileSync(join(process.cwd(), "src", rel), "utf8");
const src = read("routes/paypal.ts");

function block(method: string): string {
  const start = src.indexOf(`paypalRouter.${method}(`);
  const next = src.indexOf("\npaypalRouter.", start + 10);
  return src.slice(start, next === -1 ? src.length : next);
}

describe("PayPal connection route guards", () => {
  it("every change needs the owner role and a rate limit", () => {
    for (const m of ["put", "delete", "post"]) {
      expect(block(m)).toContain("requireOwner");
      expect(block(m)).toContain("limiter");
    }
  });

  it("the password is checked before the keys are saved or deleted", () => {
    const put = block("put");
    expect(put.indexOf("verifyPassword(")).toBeGreaterThan(-1);
    expect(put.indexOf("verifyPassword(")).toBeLessThan(put.indexOf("insert into paypal_connections"));
    const del = block("delete");
    expect(del.indexOf("verifyPassword(")).toBeLessThan(del.indexOf("delete from paypal_connections"));
  });

  it("PayPal accepts the keys before they are encrypted and stored", () => {
    const put = block("put");
    expect(put.indexOf("getAccessToken(")).toBeLessThan(put.indexOf("encryptSecret("));
  });

  it("the status route never reads the secret", () => {
    const status = src.slice(src.indexOf("async function statusFor"), src.indexOf('paypalRouter.get("/connection"'));
    expect(status).not.toContain("secret_encrypted");
    expect(status).not.toContain("clientSecret");
  });

  it("the secret never reaches a response, log or audit entry", () => {
    expect(src).not.toMatch(/res\.(json|send)\([^)]*clientSecret/);
    expect(src).not.toMatch(/logger\.[a-z]+\([^)]*clientSecret/);
    expect(src).not.toMatch(/details:\s*\{[^}]*(clientSecret|blob)/);
  });

  it("saved keys are sandbox only", () => {
    expect(block("put")).toContain("sandboxOnly()");
  });
});

describe("credential isolation", () => {
  it("the server's own keys are only used through the owner check", () => {
    const creds = read("paypal/credentials.ts");
    expect(creds.indexOf("isOwnerWorkspace(tenantId)")).toBeGreaterThan(creds.indexOf("loadTenantCredentials(tenantId)"));
    const actions = read("paypal/actions.ts");
    expect(actions).not.toContain("envCredentials");
  });
});