import pino from "pino";
import { env } from "../config/env";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "tiramisu-api" },
  timestamp: pino.stdTimeFunctions.isoTime,

  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'req.headers["x-api-key"]',
      'res.headers["set-cookie"]',
      "*.password",
      "*.token",
      "*.access_token",
      "*.secret",
      "*.apiKey",
      "*.clientSecret",
      "*.client_secret",
      "*.secret_encrypted",
    ],
    censor: "[redacted]",
  },
});