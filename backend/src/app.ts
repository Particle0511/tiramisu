import { apiRouter } from "./routes/api";
import { webhooksRouter } from "./routes/webhooks";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { healthRouter } from "./routes/health";
import { errorHandler } from "./middleware/errorHandler";

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(express.json({ limit: "100kb" }));

app.use(healthRouter);
app.use(webhooksRouter);
app.use("/api", apiRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(errorHandler);