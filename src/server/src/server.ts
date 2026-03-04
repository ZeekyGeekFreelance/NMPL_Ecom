// NOTE: .env is loaded by scripts/load-env.js via "-r" before this file runs.
// That guarantees the environment is populated before any module (config, prisma) is evaluated.
// Do NOT add a second dotenv.config() call here — it would run AFTER module-alias/register
// has already triggered module evaluation.
import path from "path";
import "reflect-metadata";
import { addAlias } from "module-alias";

const runtimeRoot = path.resolve(__dirname);
addAlias("@", runtimeRoot);

const { createApp } = require("./app") as typeof import("./app");
const { config } = require("./config") as typeof import("./config");
const { disconnectDB } = require("./infra/database/database.config") as typeof import("./infra/database/database.config");
const { disconnectRedis } = require("./infra/cache/redis") as typeof import("./infra/cache/redis");
const {
  assertApiPortParity,
  assertClusterParity,
  assertMigrationsApplied,
  assertMixedModeMismatch,
  assertPortAvailable,
  assertResourceGuards,
  printStartupDiagnostics,
} = require("./bootstrap/preflight") as typeof import("./bootstrap/preflight");
const { bootState } = require("./bootstrap/state") as typeof import("./bootstrap/state");
const {
  startQuotationExpiryWorker,
} = require("./modules/transaction/quotationExpiry.worker") as typeof import("./modules/transaction/quotationExpiry.worker");

let shuttingDown = false;

const gracefulShutdown = async (
  reason: "SIGTERM" | "SIGINT" | "uncaughtException" | "unhandledRejection",
  httpServer?: import("http").Server
): Promise<void> => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  console.log(`[shutdown] Signal received: ${reason}`);

  const results = await Promise.allSettled([
    new Promise<void>((resolve) => {
      if (!httpServer) {
        resolve();
        return;
      }
      httpServer.close(() => resolve());
    }),
    disconnectDB(),
    disconnectRedis(),
  ]);

  const labels = ["httpServer", "prisma", "redis"];
  let hasFailure = false;
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "rejected") {
      hasFailure = true;
      const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(`[shutdown] ${labels[i]} failed to close: ${msg}`);
    } else {
      console.log(`[shutdown] ${labels[i]} closed cleanly.`);
    }
  }

  process.exit(hasFailure ? 1 : 0);
};

async function bootstrap() {
  const bootStartedAt = Date.now();
  // Register signal handlers immediately so no boot window is left unguarded.
  // httpServer is captured by reference once createApp resolves.
  let httpServer: import("http").Server | undefined;

  process.on("SIGTERM", () => {
    void gracefulShutdown("SIGTERM", httpServer);
  });
  process.on("SIGINT", () => {
    void gracefulShutdown("SIGINT", httpServer);
  });
  process.on("uncaughtException", (error) => {
    console.error("[boot] uncaughtException", error);
    void gracefulShutdown("uncaughtException", httpServer);
  });
  process.on("unhandledRejection", (reason) => {
    console.error("[boot] unhandledRejection", reason);
    void gracefulShutdown("unhandledRejection", httpServer);
  });

  bootState.configValidated = true;
  assertApiPortParity();
  await assertPortAvailable();
  assertResourceGuards();
  await assertMixedModeMismatch();
  assertMigrationsApplied();
  bootState.migrationsApplied = true;

  const app = await createApp();
  httpServer = app.httpServer;
  await assertClusterParity();
  printStartupDiagnostics();

  httpServer.on("error", (err) => {
    const nodeError = err as NodeJS.ErrnoException;
    if (nodeError.code === "EADDRINUSE") {
      console.error(
        `[boot] Port ${config.server.port} is already in use. Update PORT and client API env consistently.`
      );
    } else {
      console.error("[boot] Server error:", err);
    }
    process.exit(1);
  });

  httpServer.listen(config.server.port, () => {
    const bootDurationMs = Date.now() - bootStartedAt;
    console.log(`[boot] Server is running on port ${config.server.port}`);
    console.log(`[perf] boot-summary ${JSON.stringify({ bootDurationMs })}`);

    setTimeout(() => {
      startQuotationExpiryWorker();
    }, 0).unref();
  });
}

bootstrap().catch((error) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`Failed to bootstrap server: ${errorMessage}`);
  process.exit(1);
});
