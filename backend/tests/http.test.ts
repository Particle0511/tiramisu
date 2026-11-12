import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app";

const UUID = "11111111-1111-1111-1111-111111111111";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const sigHeaders = (over: Record<string, string> = {}) => ({
  "paypal-auth-algo": "SHA256withRSA",
  "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-x",
  "paypal-transmission-id": "tid-1",
  "paypal-transmission-sig": "sig",
  "paypal-transmission-time": new Date().toISOString(),
  ...over,
});
const eventBody = JSON.stringify({ id: "WH-1", event_type: "CUSTOMER.DISPUTE.CREATED" });

describe("security headers and basics", () => {
  it("health responds and sets security headers", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["strict-transport-security"]).toBeDefined();
    expect(res.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(res.headers["x-request-id"]).toBeDefined();
  });

  it("unknown routes return a plain 404", async () => {
    const res = await request(app).post("/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });
});

describe("every API route requires login", () => {
  const routes: [string, string][] = [
    ["get", "/api/me"],
    ["get", "/api/disputes"],
    ["get", `/api/disputes/${UUID}`],
    ["get", "/api/audit"],
    ["get", "/api/audit/verify"],
    ["get", "/api/risks"],
    ["post", "/api/demo/seed"],
    ["post", "/api/paypal/sync"],
    ["post", "/api/actions"],
    ["post", `/api/actions/${UUID}/approve`],
    ["post", `/api/disputes/${UUID}/draft`],
    ["post", `/api/disputes/${UUID}/respond`],
  ];

  it.each(routes)("%s %s is refused without a token", async (method, path) => {
    const res = await (request(app) as any)[method](path);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Not signed in" });
  });

  it("refuses a Bearer token that is far too long", async () => {
    const res = await request(app)
      .get("/api/me")
      .set("Authorization", "Bearer " + "a".repeat(5000));
    expect(res.status).toBe(401);
  });

  it("refuses a non-Bearer authorization scheme", async () => {
    const res = await request(app).get("/api/me").set("Authorization", "Basic YWJjOmRlZg==");
    expect(res.status).toBe(401);
  });
});

describe("webhook input checks (before any network call)", () => {
  const post = () =>
    request(app).post("/webhooks/paypal").set("Content-Type", "application/json");

  it("rejects a request with no signature headers", async () => {
    const res = await post().send(eventBody);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Missing PayPal signature headers");
  });

  it("rejects a certificate URL on a look-alike domain", async () => {
    const res = await post()
      .set(sigHeaders({ "paypal-cert-url": "https://paypal.com.evil.com/cert" }))
      .send(eventBody);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid certificate URL");
  });

  it("rejects an old transmission time", async () => {
    const res = await post()
      .set(sigHeaders({ "paypal-transmission-time": "2020-01-01T00:00:00Z" }))
      .send(eventBody);
    expect(res.status).toBe(400);
  });

  it("rejects malformed JSON", async () => {
    const res = await post().set(sigHeaders()).send("{");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Malformed JSON");
  });

  it("rejects a body that is not JSON", async () => {
    const res = await request(app)
      .post("/webhooks/paypal")
      .set("Content-Type", "text/plain")
      .set(sigHeaders())
      .send(eventBody);
    expect(res.status).toBe(400);
  });
});

describe("request limits", () => {
  it("rejects a body over 100 KB with 413", async () => {
    const res = await request(app)
      .post("/api/actions")
      .send({ filler: "a".repeat(200_000) });
    expect(res.status).toBe(413);
    expect(res.body.error).toBe("Request too large");
    expect(res.body.requestId).toBeDefined();
  });

  it("rejects malformed JSON with 400 and a request ID", async () => {
    const res = await request(app)
      .post("/api/actions")
      .set("Content-Type", "application/json")
      .send("{");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Bad request");
    expect(res.body.requestId).toBeDefined();
  });
});

describe("CORS", () => {
  it("does not allow an unknown origin", async () => {
    const res = await request(app).get("/health").set("Origin", "https://evil.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("allows only the configured frontend origin", async () => {
    const res = await request(app).get("/health").set("Origin", "http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });
});

describe("request IDs", () => {
  it("echoes a safe incoming ID", async () => {
    const res = await request(app).get("/health").set("X-Request-Id", "req-12345678");
    expect(res.headers["x-request-id"]).toBe("req-12345678");
  });

  it("replaces an unsafe incoming ID with a generated one", async () => {
    const res = await request(app).get("/health").set("X-Request-Id", "not a valid id!");
    expect(res.headers["x-request-id"]).toMatch(UUID_RE);
  });
});