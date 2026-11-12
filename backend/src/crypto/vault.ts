import { env } from "../config/env";
import { parseKey } from "./secrets";

let cached: Buffer | null = null;

export function encryptionConfigured(): boolean {
  return env.CREDENTIALS_ENCRYPTION_KEY.length > 0;
}

export function vaultKey(): Buffer {
  if (!cached) {
    if (!encryptionConfigured()) throw new Error("CREDENTIALS_ENCRYPTION_KEY is not set");
    cached = parseKey(env.CREDENTIALS_ENCRYPTION_KEY);
  }
  return cached;
}