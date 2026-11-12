import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const read = (rel: string) => readFileSync(join(process.cwd(), "src", rel), "utf8");

describe("settings security guards", () => {
  const settings = read("routes/settings.ts");
  const putAt = settings.indexOf("settingsRouter.put(");

  it("only an owner can change settings", () => {
    expect(putAt).toBeGreaterThan(-1);
    expect(settings.slice(putAt)).toContain("requireOwner");
  });

  it("changing settings is rate limited", () => {
    expect(settings.slice(putAt)).toMatch(/settingsLimiter/);
  });

  it("the password is re-checked before the limit is updated", () => {
    const verifyAt = settings.indexOf("verifyPassword(");
    const updateAt = settings.indexOf("update tenants set max_refund_minor");
    expect(verifyAt).toBeGreaterThan(-1);
    expect(updateAt).toBeGreaterThan(-1);
    expect(verifyAt).toBeLessThan(updateAt);
  });

  it("settings sit behind login", () => {
    const api = read("routes/api.ts");
    const authAt = api.indexOf("apiRouter.use(requireAuth)");
    const mountAt = api.indexOf('apiRouter.use("/settings"');
    expect(mountAt).toBeGreaterThan(-1);
    expect(authAt).toBeLessThan(mountAt);
  });
});