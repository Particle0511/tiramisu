import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 15_000,
    env: {
      NODE_ENV: "test",
      LOG_LEVEL: "fatal",
      PORT: "4000",
      FRONTEND_ORIGIN: "http://localhost:5173",
      PAYPAL_BASE_URL: "http://127.0.0.1:9",
      PAYPAL_CLIENT_ID: "test-client-id",
      PAYPAL_CLIENT_SECRET: "test-client-secret",
      PAYPAL_WEBHOOK_ID: "test-webhook-id",
      PAYPAL_SYNC_ALLOWED_EMAILS: "",
      DATABASE_URL: "postgresql://nobody:nothing@127.0.0.1:9/none",
      AI_BASE_URL: "http://127.0.0.1:9",
      AI_API_KEY: "test-key",
      AI_MODEL: "test-model",
      SUPABASE_URL: "http://127.0.0.1:9",
      SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    },
  },
});