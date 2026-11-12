import { Router } from "express";
import { pool } from "../db/client";
import { state } from "../lifecycle";

export const healthRouter = Router();


healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});


healthRouter.get("/ready", async (_req, res) => {
  if (state.shuttingDown) {
    res.status(503).json({ status: "shutting_down" });
    return;
  }
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      pool.query("select 1"),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("database timeout")), 3000);
      }),
    ]);
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  } finally {
    if (timer) clearTimeout(timer);
  }
});