import "dotenv/config";
import "reflect-metadata";
import { addAlias } from "module-alias";
import path from "path";

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

  try {
    await Promise.allSettled([
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
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[shutdown] Failed clean shutdown: ${message}`);
    process.exit(1);
  }
};

async function bootstrap() {
  bootState.configValidated = true;
  assertApiPortParity();
  await assertPortAvailable();
  assertResourceGuards();
  await assertMixedModeMismatch();
  assertMigrationsApplied();
  bootState.migrationsApplied = true;

  const { httpServer } = await createApp();
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

  httpServer.listen(config.server.port, () => {
    console.log(`[boot] Server is running on port ${config.server.port}`);
  });
}

bootstrap().catch((error) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`Failed to bootstrap server: ${errorMessage}`);
  process.exit(1);
});
