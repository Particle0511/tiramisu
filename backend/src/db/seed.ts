import { pool } from "./client";
import { seedTenant } from "./seedData";

const DEMO_TENANT = "11111111-1111-1111-1111-111111111111";

seedTenant(DEMO_TENANT)
  .then(() => console.log("Seeded demo tenant"))
  .catch((e) => {
    console.error("Seed failed:", e.message);
    process.exit(1);
  })
  .finally(() => pool.end());