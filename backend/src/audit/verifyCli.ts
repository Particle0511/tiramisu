import { pool } from "../db/client";
import { verifyChain } from "./log";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx src/audit/verifyCli.ts user-A-email");
    process.exit(1);
  }
  const u = await pool.query(`select tenant_id from users where lower(email) = lower($1)`, [email]);
  if (u.rowCount === 0) throw new Error("No user with that email");
  console.log(await verifyChain(u.rows[0].tenant_id));
  await pool.end();
}

main().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});