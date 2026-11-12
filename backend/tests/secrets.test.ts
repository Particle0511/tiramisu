
import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import {
  encryptSecret,
  decryptSecret,
  parseKey,
} from "../src/crypto/secrets";

const key = randomBytes(32);
const tenant = "11111111-1111-1111-1111-111111111111";
const other = "22222222-2222-2222-2222-222222222222";
const secret = "EJ8x-this_is_a_fake_paypal_secret_value_1234567890";

describe("encryptSecret and decryptSecret", () => {
  it("round trips", () => {
    const blob = encryptSecret(secret, tenant, key);
    expect(decryptSecret(blob, tenant, key)).toBe(secret);
  });

  it("never contains the plain text", () => {
    const blob = encryptSecret(secret, tenant, key);
    expect(blob).not.toContain(secret);
    expect(blob.startsWith("v1.")).toBe(true);
  });

  it("uses a new random value every time", () => {
    expect(encryptSecret(secret, tenant, key)).not.toBe(
      encryptSecret(secret, tenant, key)
    );
  });

  it("fails for a different workspace", () => {
    const blob = encryptSecret(secret, tenant, key);
    expect(() => decryptSecret(blob, other, key)).toThrow();
  });

  it("fails with a different key", () => {
    const blob = encryptSecret(secret, tenant, key);
    expect(() => decryptSecret(blob, tenant, randomBytes(32))).toThrow();
  });

  it("detects tampering", () => {
    const parts = encryptSecret(secret, tenant, key).split(".");
    const ciphertext = Buffer.from(parts[3], "base64");

    ciphertext[0] ^= 1;
    parts[3] = ciphertext.toString("base64");

    expect(() => decryptSecret(parts.join("."), tenant, key)).toThrow();
  });

  it("rejects malformed input", () => {
    expect(() => decryptSecret("nonsense", tenant, key)).toThrow();
    expect(() => decryptSecret("v2.a.b.c", tenant, key)).toThrow();
    expect(() => decryptSecret("v1.AAAA.AAAA.AAAA", tenant, key)).toThrow();
  });
});

describe("parseKey", () => {
  it("accepts base64 and hex keys of 32 bytes", () => {
    const raw = randomBytes(32);

    expect(parseKey(raw.toString("base64")).equals(raw)).toBe(true);
    expect(parseKey(raw.toString("hex")).equals(raw)).toBe(true);
  });

  it("rejects keys that are too short or too long", () => {
    expect(() => parseKey(randomBytes(16).toString("base64"))).toThrow();
    expect(() => parseKey(randomBytes(48).toString("base64"))).toThrow();
    expect(() => parseKey("")).toThrow();
  });
});
