import { createHash } from "crypto";

// JSON with sorted keys, so the hash does not depend on key order
export function stable(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stable(obj[k])).join(",") + "}";
}

export type HashFields = {
  tenantId: string;
  seq: number;
  actor: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: unknown;
  prevHash: string;
  createdAt: string; // ISO string
};

export function computeHash(f: HashFields): string {
  return createHash("sha256")
    .update(
      stable([
        f.tenantId, f.seq, f.actor, f.action, f.targetType,
        f.targetId, f.details, f.prevHash, f.createdAt,
      ])
    )
    .digest("hex");
}