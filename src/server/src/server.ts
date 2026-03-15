// NOTE: .env is loaded by scripts/load-env.js via "-r" before this file runs.
// That guarantees the environment is populated before any module (config, prisma) is evaluated.
// Do NOT add a second dotenv.config() call here — it would run AFTER module-alias/register
// has already triggered module evaluation.

// Global error handlers MUST be registered before any imports
import path from "path";
import "reflect-metadata";
import { addAlias } from "module-alias";

const runtimeRoot = path.resolve(__dirname);
addAlias("@", runtimeRoot);

const { createApp } = require("./app") as typeof import("./app");
const { config } = require("./config") as typeof import("./config");
const { connectDB, disconnectDB } = require("./infra/database/database.config") as typeof import("./infra/database/database.config");
const { connectRedis, disconnectRedis } = require("./infra/cache/redis") as typeof import("./infra/cache/redis");
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

  // Register signal handlers immediately — no boot window is left unguarded.
  // httpServer is captured by reference once the server starts listening.
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

  // ── PHASE 1: Config validation & preflight assertions ───────────────────
  console.log("\n[boot] SERVER STARTING");
  bootState.configValidated = true;
  assertApiPortParity();
  await assertPortAvailable();
  assertResourceGuards();
  await assertMixedModeMismatch();
  assertMigrationsApplied();
  bootState.migrationsApplied = true;

  // ── PHASE 2: Build express app + HTTP server ─────────────────────────────
  // createApp() sets up all middleware and routes but does NOT connect to the
  // database.  The readiness gate inside createApp() returns 503 for all API
  // traffic until bootState.serverReady is set to true in Phase 4 below.
  const app = await createApp();
  httpServer = app.httpServer;

  httpServer.on("error", (err) => {
    const nodeError = err as NodeJS.ErrnoException;
    if (nodeError.code === "EADDRINUSE") {
      console.error(
        `[boot] Port ${config.server.port} is already in use. ` +
        `Update PORT and client API env consistently.`
      );
    } else {
      console.error("[boot] Server error:", err);
    }
    process.exit(1);
  });

  // ── PHASE 3: START LISTENING (health checks available immediately) ───────
  // The server begins accepting connections NOW, before the DB is connected.
  // /health returns {"healthy":false} during Phase 4 — that is correct and
  // expected.  Docker's start_period + retries window covers the full DB
  // startup time.  The frontend useBackendReady hook polls /health and gates
  // data fetches behind it.
  await new Promise<void>((resolve) => {
    httpServer!.listen(config.server.port, () => {
      console.log(`[boot] ✅ SERVER LISTENING on :${config.server.port}`);
      resolve();
    });
  });

  printStartupDiagnostics();

  // ── PHASE 4: Connect to DB and Redis (runs after server is already live) ─
  // This task runs asynchronously relative to the HTTP server — the server
  // continues handling health probes while this resolves.
  // On success: sets bootState.serverReady = true → API routes open.
  // On fatal failure: triggers graceful shutdown.
  const connectionTask = async (): Promise<void> => {
    await connectDB();

    if (config.redis.enabled) {
      await connectRedis();
    }

    // Cluster parity check requires a live Redis connection.
    await assertClusterParity();

    // ── SERVER IS NOW FULLY READY ─────────────────────────────────────────
    bootState.serverReady = true;

    const bootDurationMs = Date.now() - bootStartedAt;
    console.log("\n╔══════════════════════════════════════════╗");
    console.log(`║  ✅ DATABASE CONNECTED                   ║`);
    console.log(`║  ✅ CACHE INITIALIZED                    ║`);
    console.log(`║  ✅ SERVER READY — accepting API traffic ║`);
    console.log(`║  ⏱  Boot time: ${String(bootDurationMs + "ms").padEnd(25)}║`);
    console.log("╚══════════════════════════════════════════╝\n");
    console.log(`[perf] boot-summary ${JSON.stringify({ bootDurationMs })}`);

    // Start background workers after the data layer is fully ready.
    setTimeout(() => {
      startQuotationExpiryWorker();
      
      // Start data cleanup cron job
      try {
        require("./workers/cron");
        console.log("[boot] ✅ Data cleanup cron job registered");
      } catch (error) {
        console.error("[boot] ⚠️  Failed to register cleanup cron:", error);
      }
    }, 0).unref();
  };

  connectionTask().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[boot] ❌ FATAL: Failed to establish database/cache connections: ${msg}`);
    // Trigger graceful shutdown — the container restart policy will
    // bring the server back up once the DB becomes reachable.
    void gracefulShutdown("uncaughtException", httpServer);
  });
}

bootstrap().catch((error) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`[boot] Failed to bootstrap server: ${errorMessage}`);
  process.exit(1);
});
