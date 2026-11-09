import { pool } from "../db/client";
import { createAction, approveAction, rejectAction, GateError } from "./gate";
import { verifyChain } from "../audit/log";

const TENANT = "11111111-1111-1111-1111-111111111111";

async function expectCode(label: string, fn: () => Promise<unknown>, code: string) {
  try {
    await fn();
    console.log(`${label} -> FAIL (it was allowed)`);
  } catch (e) {
    const got = e instanceof GateError ? e.code : "other error";
    console.log(`${label} -> ${got === code ? "PASS" : "FAIL"} (${got})`);
  }
}

async function main() {
  const d = await pool.query(
    `select id from disputes where paypal_dispute_id = 'DEMO-INR-001' and tenant_id = $1`,
    [TENANT]
  );
  if (d.rowCount === 0) {
    console.log("Run npm run seed first.");
    await pool.end();
    return;
  }
  const disputeId = d.rows[0].id;
  const created: string[] = [];
  const make = async (input: Record<string, unknown>) => {
    const a = await createAction(TENANT, { disputeId, ...input }, "test-user");
    created.push(a.id);
    return a.id;
  };

  const okId = await make({ actionType: "REFUND", amountMinor: 3000, currency: "USD" });
  const r1 = await approveAction(TENANT, okId, "test-user");
  console.log(`1. approve within limits -> ${r1.status === "executed" ? "PASS" : "FAIL"} (${r1.status})`);

  await expectCode("2. approve the same action again (double click)", () => approveAction(TENANT, okId, "test-user"), "not_pending");

  const big = await make({ actionType: "REFUND", amountMinor: 6000, currency: "USD" });
  await expectCode("3. refund above the maximum", () => approveAction(TENANT, big, "test-user"), "blocked");

  const eur = await make({ actionType: "REFUND", amountMinor: 2000, currency: "EUR" });
  await expectCode("4. refund in the wrong currency", () => approveAction(TENANT, eur, "test-user"), "blocked");

  const rej = await make({ actionType: "REFUND", amountMinor: 1000, currency: "USD" });
  await rejectAction(TENANT, rej, "test-user");
  await expectCode("5. approve a rejected action", () => approveAction(TENANT, rej, "test-user"), "not_pending");

  await expectCode("6. act on a dispute that does not exist", () =>
    createAction(TENANT, { disputeId: "00000000-0000-0000-0000-000000000000", actionType: "RESPOND" }, "test-user"), "not_found");

  try {
    await pool.query(`update audit_log set actor = 'attacker' where tenant_id = $1`, [TENANT]);
    console.log("7. edit the audit log -> FAIL (it was allowed)");
  } catch {
    console.log("7. edit the audit log -> PASS (refused)");
  }

  const chain = await verifyChain(TENANT);
  console.log(`8. audit chain intact -> ${chain.ok ? "PASS" : "FAIL"} (${chain.checked} entries)`);

  await pool.query(`delete from pending_actions where id = any($1)`, [created]);
  await pool.end();
}

main().catch((e) => {
  console.error("Gate test failed:", e.message);
  process.exit(1);
});