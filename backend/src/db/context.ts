import { AsyncLocalStorage } from "async_hooks";

const storage = new AsyncLocalStorage<{ tenantId: string }>();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  if (!UUID.test(tenantId)) throw new Error("Invalid tenant id");
  return storage.run({ tenantId }, fn);
}

export function currentTenant(): string | null {
  return storage.getStore()?.tenantId ?? null;
}