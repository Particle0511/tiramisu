import "dotenv/config";
import { z } from "zod";
import { parseKey } from "../crypto/secrets";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  FRONTEND_ORIGIN: z.string().default("http://localhost:5173"),
  PAYPAL_BASE_URL: z.string().url().default("https://api-m.sandbox.paypal.com"),
  PAYPAL_CLIENT_ID: z.string().min(1),
  PAYPAL_CLIENT_SECRET: z.string().min(1),
  PAYPAL_WEBHOOK_ID: z.string().min(1),
  PAYPAL_SYNC_ALLOWED_EMAILS: z.string().default(""),
  WEBHOOK_TENANT_EMAIL: z.string().default(""),
  CREDENTIALS_ENCRYPTION_KEY: z.string().default(""),
  DATABASE_URL: z.string().min(1),
  DATABASE_CA_BASE64: z.string().default(""),
  AI_BASE_URL: z.string().url(),
  AI_API_KEY: z.string().min(1),
  AI_MODEL: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;


if (env.CREDENTIALS_ENCRYPTION_KEY) {
  try {
    parseKey(env.CREDENTIALS_ENCRYPTION_KEY);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}


if (env.NODE_ENV === "production") {
  if (!env.FRONTEND_ORIGIN.startsWith("https://")) {
    console.error("In production, FRONTEND_ORIGIN must start with https://");
    process.exit(1);
  }
  if (!env.CREDENTIALS_ENCRYPTION_KEY) {
    console.error("In production, CREDENTIALS_ENCRYPTION_KEY must be set");
    process.exit(1);
  }
  if (env.PAYPAL_WEBHOOK_ID === "placeholder") {
 
    console.warn("PAYPAL_WEBHOOK_ID is still a placeholder: PayPal webhooks will be rejected");
  }
}