import { describe, it, expect } from "vitest";
import { connectionInput, maskClientId } from "../src/paypal/connectionInput";

const id = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdEfGhIjKl";
const secret = "EJ8xAbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdEfGh";

describe("connectionInput", () => {
  it("accepts realistic keys", () => {
    expect(connectionInput.safeParse({ clientId: id, clientSecret: secret, password: "x" }).success).toBe(true);
  });

  it("trims spaces pasted around the keys", () => {
    const r = connectionInput.safeParse({ clientId: ` ${id} `, clientSecret: `${secret}\n`, password: "x" });
    expect(r.success && r.data.clientId === id && r.data.clientSecret === secret).toBe(true);
  });

  it("rejects short, spaced or odd values", () => {
    expect(connectionInput.safeParse({ clientId: "short", clientSecret: secret, password: "x" }).success).toBe(false);
    expect(connectionInput.safeParse({ clientId: id, clientSecret: "has space " + secret, password: "x" }).success).toBe(false);
    expect(connectionInput.safeParse({ clientId: id + "'; drop table", clientSecret: secret, password: "x" }).success).toBe(false);
  });

  it("requires the password", () => {
    expect(connectionInput.safeParse({ clientId: id, clientSecret: secret }).success).toBe(false);
    expect(connectionInput.safeParse({ clientId: id, clientSecret: secret, password: "" }).success).toBe(false);
  });
});

describe("maskClientId", () => {
  it("shows only the ends", () => {
    expect(maskClientId(id)).toBe("AbCd...IjKl");
  });

  it("hides very short values completely", () => {
    expect(maskClientId("abc")).toBe("****");
  });
});