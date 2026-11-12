import { Router } from "express";
import { loadAlerts } from "../risk/alerts";

export const risksRouter = Router();

risksRouter.get("/", async (req, res, next) => {
  try {
    res.json({ alerts: await loadAlerts(req.auth!.tenantId) });
  } catch (e) {
    next(e);
  }
});