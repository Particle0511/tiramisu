import type { ErrorRequestHandler } from "express";
import { logger } from "../utils/logger";

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const requestId = String(res.getHeader("X-Request-Id") ?? "");
  const raw = err?.status ?? err?.statusCode;
  const status = typeof raw === "number" && raw >= 400 && raw < 500 ? raw : 500;

  if (status === 500) {
    logger.error({ err, requestId, method: req.method, path: req.path }, "request failed");
  }

  const message =
    status === 500 ? "Internal server error" : status === 413 ? "Request too large" : "Bad request";

  res.status(status).json({ error: message, requestId });
};