import { createServer, type Server } from "node:http";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import app from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

function listen(): Promise<Server> {
  return new Promise((resolveListen, rejectListen) => {
    const server = createServer(app);
    server.once("error", rejectListen);
    server.listen(env.PORT, () => {
      server.off("error", rejectListen);
      resolveListen(server);
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error) {
        rejectClose(error);
        return;
      }
      resolveClose();
    });
  });
}

export async function startServer(): Promise<Server> {
  await connectDatabase();
  const server = await listen();
  logger.info({ port: env.PORT }, "HTTP server listening");

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, "Graceful shutdown started");
    void closeServer(server)
      .finally(disconnectDatabase)
      .then(() => {
        logger.info("Graceful shutdown complete");
      })
      .catch((error: unknown) => {
        logger.error({ err: error }, "Graceful shutdown failed");
        process.exitCode = 1;
      });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  return server;
}

const entrypoint = process.argv[1];
if (entrypoint !== undefined && import.meta.url === pathToFileURL(resolve(entrypoint)).href) {
  startServer().catch((error: unknown) => {
    logger.error({ err: error }, "Server startup failed");
    process.exitCode = 1;
  });
}
