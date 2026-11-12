import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const VERSION = "v1";


export function parseKey(encoded: string): Buffer {
  const text = encoded.trim();
  const buf = /^[0-9a-fA-F]{64}$/.test(text) ? Buffer.from(text, "hex") : Buffer.from(text, "base64");
  if (buf.length !== 32) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY must be 32 bytes (base64 or 64 hex characters)");
  }
  return buf;
}


export function encryptSecret(plaintext: string, aad: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(".");
}

export function decryptSecret(blob: string, aad: string, key: Buffer): string {
  const parts = blob.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error("Unsupported secret format");
  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const ct = Buffer.from(parts[3], "base64");
  if (iv.length !== 12 || tag.length !== 16) throw new Error("Unsupported secret format");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}