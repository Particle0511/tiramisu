import { app } from "./app";
import { env } from "./config/env";
import { pool } from "./db/client";
import { logger } from "./utils/logger";
import { state } from "./lifecycle";
import { startWorker, stopWorker } from "./jobs/worker";

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "server started");
  startWorker();
});


server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

let closing = false;

function shutdown(signal: string, code = 0): void {
  if (closing) return;
  closing = true;
  state.shuttingDown = true; 
  logger.info({ signal }, "shutting down");

  const force = setTimeout(() => {
    logger.error("forced exit after timeout");
    process.exit(1);
  }, 15_000);
  force.unref();

  stopWorker();
  server.close(async (err) => {
    if (err) logger.error({ err }, "error while closing the server");
    try {
      await pool.end();
    } catch (e) {
      logger.error({ err: e }, "error while closing the database pool");
    }
    logger.info("shutdown complete");
    process.exit(err ? 1 : code);
  });
  server.closeIdleConnections();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "unhandled rejection");
  shutdown("unhandledRejection", 1);
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaught exception");
  process.exit(1);
});