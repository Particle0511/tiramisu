import fs from "fs";
import path from "path";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { resolveRequestId } from "./utils/requestId";
import { healthRouter } from "./routes/health";
import { webhooksRouter } from "./routes/webhooks";
import { apiRouter } from "./routes/api";
import { errorHandler } from "./middleware/errorHandler";

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

// One log line per request, with an ID that also goes back to the caller
app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const id = resolveRequestId(req.headers["x-request-id"]);
      res.setHeader("X-Request-Id", id);
      return id;
    },
    // Only the fields we need: no headers, so nothing sensitive can leak into logs
    serializers: {
      req: (req: any) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res: any) => ({ statusCode: res.statusCode }),
    },
    // Uptime pings should not flood the logs
    autoLogging: {
      ignore: (req) => req.url === "/health" || req.url === "/ready",
    },
  })
);

// The website talks to Supabase (sign-in) straight from the browser, so that one address is allowed
const supabaseOrigin = new URL(env.SUPABASE_URL).origin;
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: { "connect-src": ["'self'", supabaseOrigin] },
    },
  })
);

// A list (not a plain string) makes the cors package answer only when the request's
// Origin is on it. Any other origin gets no CORS headers at all.
app.use(cors({ origin: [env.FRONTEND_ORIGIN], credentials: true }));

// Monitors are not rate limited
app.use(healthRouter);

app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// The webhook route needs the exact raw body for signature checking.
// This must come before express.json, which then skips this route.
app.use("/webhooks", express.raw({ type: "application/json", limit: "100kb" }));
app.use(express.json({ limit: "100kb" }));

app.use(webhooksRouter);
app.use("/api", apiRouter);

// Serve the built website from this same service when it exists (one address for everything)
const siteDir = path.resolve(process.cwd(), "..", "frontend", "dist");
const indexFile = path.join(siteDir, "index.html");
if (fs.existsSync(indexFile)) {
  app.use(
    express.static(siteDir, {
      index: false,
      maxAge: "1d",
      setHeaders: (res, file) => {
        if (file.endsWith("index.html")) res.setHeader("Cache-Control", "no-cache");
      },
    })
  );
  // Any other page address belongs to the website's own router
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api/") || req.path.startsWith("/webhooks/")) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(indexFile, (err) => {
      if (err) next(err);
    });
  });
}

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(errorHandler);