import { pool } from "../db/client";
import { generateDraft } from "./draft";

const TENANT = "11111111-1111-1111-1111-111111111111";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  for (const code of ["DEMO-INR-001", "DEMO-INR-002", "DEMO-INR-003"]) {
    const d = await pool.query(
      `select id from disputes where paypal_dispute_id = $1 and tenant_id = $2`,
      [code, TENANT]
    );
    if (d.rowCount === 0) {
      console.log(code, "not found. Run npm run seed first.");
      continue;
    }

    console.log(`\n=== ${code} ===`);
    try {
      const draft = await generateDraft(d.rows[0].id, TENANT);
      console.log("Kept statements:", draft.statements.length);
      for (const s of draft.statements) console.log(" +", s.text);
      console.log("Dropped statements:", draft.dropped.length);
      for (const x of draft.dropped) console.log(" -", x.text, "|", x.reason);
      console.log("Flagged buyer messages:", draft.flaggedMessages.length);
      if (code === "DEMO-INR-003") {
        const mentionsRefund = draft.statements.some((s) => /refund/i.test(s.text));
        console.log("Draft mentions a refund (should be false):", mentionsRefund);
      }
    } catch (e) {
      console.log("Failed:", (e as Error).message);
    }
    await sleep(7000); // stay under the free-tier requests per minute
  }
  await pool.end();
}

main();