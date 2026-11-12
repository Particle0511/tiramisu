import { randomUUID } from "crypto";


const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

export function resolveRequestId(incoming: unknown): string {
  if (typeof incoming === "string" && SAFE_ID.test(incoming)) return incoming;
  return randomUUID();
}