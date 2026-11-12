import { describe, it, expect } from "vitest";
import { runWithTenant, currentTenant } from "../src/db/context";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("tenant context", () => {
  it("is empty outside a request", () => {
    expect(currentTenant()).toBeNull();
  });

  it("holds the tenant inside", () => {
    runWithTenant(A, () => expect(currentTenant()).toBe(A));
  });

  it("keeps the tenant across awaits", async () => {
    await runWithTenant(A, async () => {
      await sleep(5);
      expect(currentTenant()).toBe(A);
    });
  });

  it("restores the outer tenant after a nested run", () => {
    runWithTenant(A, () => {
      runWithTenant(B, () => expect(currentTenant()).toBe(B));
      expect(currentTenant()).toBe(A);
    });
  });

  it("rejects a tenant id that is not a UUID", () => {
    expect(() => runWithTenant("x'; drop table disputes;--", () => 1)).toThrow();
    expect(() => runWithTenant("", () => 1)).toThrow();
  });

  it("does not leak between concurrent requests", async () => {
    const seen: string[] = [];
    await Promise.all([
      runWithTenant(A, async () => {
        await sleep(10);
        seen.push(`a:${currentTenant()}`);
      }),
      runWithTenant(B, async () => {
        await sleep(2);
        seen.push(`b:${currentTenant()}`);
      }),
    ]);
    expect(seen.sort()).toEqual([`a:${A}`, `b:${B}`]);
  });
});