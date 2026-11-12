import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { currentTenant } from "./context";


const ca = env.DATABASE_CA_BASE64
  ? Buffer.from(env.DATABASE_CA_BASE64, "base64").toString("utf8")
  : undefined;

if (!ca && env.NODE_ENV === "production") {
  logger.warn("DATABASE_CA_BASE64 is not set: database TLS is encrypted but not verified");
}

const raw = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false },
  max: 10,
  connectionTimeoutMillis: 10_000,
});

raw.on("error", (err) => logger.error({ err }, "unexpected database error"));


const SET_TENANT = "select set_config('app.tenant_id', $1, true)";
const BEGIN = /^\s*begin\b/i;


function bindTenant(client: PoolClient, tenantId: string): PoolClient {
  const original = client.query.bind(client) as (...args: any[]) => Promise<any>;
  const wrapped = async (...args: any[]) => {
    const result = await original(...args);
    const first = args[0];
    const text = typeof first === "string" ? first : first?.text;
    if (typeof text === "string" && BEGIN.test(text)) {
      await original(SET_TENANT, [tenantId]);
    }
    return result;
  };
  return new Proxy(client, {
    get(target, prop) {
      if (prop === "query") return wrapped;
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

async function query<R extends QueryResultRow = any>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<R>> {
  const tenantId = currentTenant();
  if (!tenantId) return raw.query<R>(text, params as any[]);


  const client = await raw.connect();
  let broken = false;
  try {
    await client.query("begin");
    await client.query(SET_TENANT, [tenantId]);
    const result = await client.query<R>(text, params as any[]);
    await client.query("commit");
    return result;
  } catch (err) {
    try {
      await client.query("rollback");
    } catch {
      broken = true;
    }
    throw err;
  } finally {
    client.release(broken ? true : undefined);
  }
}

async function connect(): Promise<PoolClient> {
  const client = await raw.connect();
  const tenantId = currentTenant();
  return tenantId ? bindTenant(client, tenantId) : client;
}

export const pool = { query, connect, end: () => raw.end() };