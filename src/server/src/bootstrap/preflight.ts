import net from "net";
import path from "path";
import { spawnSync } from "child_process";
import { config, configHash, isLocalAddress } from "@/config";
import redisClient from "@/infra/cache/redis";

const PRISMA_STATUS_OK_PATTERNS = [
  "Database schema is up to date",
  "No pending migrations",
  "Already in sync",
];

const runPrismaMigrateStatus = (): { output: string; ok: boolean } => {
  const serverRoot = path.resolve(__dirname, "..", "..");
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(
    command,
    ["prisma", "migrate", "status", "--schema", "./prisma/schema.prisma"],
    {
      cwd: serverRoot,
      // Use live process.env, NOT config.raw.
      // config.raw is snapshotted at module-eval time and may contain stale
      // system-level env vars (e.g. DATABASE_URL=localhost:5433) before
      // load-env.js has had a chance to correct them.
      // process.env at call time always reflects the corrected values.
      env: process.env as NodeJS.ProcessEnv,
      encoding: "utf8",
      stdio: "pipe",
      timeout: 25_000,
    }
  );

  const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
  const statusOk = result.status === 0;
  const textIndicatesOk = PRISMA_STATUS_OK_PATTERNS.some((pattern) =>
    output.includes(pattern)
  );

  return {
    output,
    ok: statusOk || textIndicatesOk,
  };
};

const probeTcpPort = (host: string, port: number, timeoutMs: number): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const done = (isOpen: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(isOpen);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });

export const assertPortAvailable = async (): Promise<void> => {
  // In production and Docker dev containers, port collision detection via TCP
  // probe is unreliable: the platform/container already owns the port, and
  // nodemon restarts can briefly observe the previous process still releasing
  // it. That creates false positives and crash loops. If the port is genuinely
  // unusable, httpServer.listen() will still surface EADDRINUSE.
  if (config.isProduction || config.dockerMode) {
    return;
  }

  // Retry up to 4 times with a 1-second gap before declaring a real collision.
  // This handles the common nodemon restart scenario where the previous process
  // has just crashed and its port is still in TIME_WAIT. A genuine "another
  // application owns this port" situation is still caught after the retries.
  const MAX_ATTEMPTS = 4;
  const RETRY_DELAY_MS = 1_000;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const inUse = await probeTcpPort("127.0.0.1", config.server.port, 750);
    if (!inUse) {
      return;
    }

    if (attempt < MAX_ATTEMPTS) {
      console.warn(
        `[preflight] Port ${config.server.port} still in use (attempt ${attempt}/${MAX_ATTEMPTS}). Waiting ${RETRY_DELAY_MS}ms for OS to release it…`
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  const message =
    `[preflight] Port collision on ${config.server.port} persists after ${MAX_ATTEMPTS} attempts. ` +
    `Stop the existing process or change PORT in .env.`;
  throw new Error(message);
};

export const assertMigrationsApplied = (): void => {
  // In production, `prisma migrate deploy` already ran in the container CMD
  // before this function is called, so re-running `prisma migrate status`
  // is redundant and risks a race (DB still initializing, spawnSync timeout).
  // Trust the CMD step in production and skip this check.
  if (config.isProduction) {
    console.log("[preflight] Skipping migration status check in production (migrate deploy ran in CMD).");
    return;
  }

  const migrationStatus = runPrismaMigrateStatus();
  if (migrationStatus.ok) {
    return;
  }

  const message = `[preflight] Migration check failed.\n${migrationStatus.output}`;

  // Development: warn and continue.
  // The developer may intentionally be ahead of the DB (pending migration apply)
  // or the DB URL may temporarily be unavailable. Do not crash-loop on this.
  console.warn(`${message}\n[preflight] Non-fatal in development. Run: npx prisma migrate deploy`);
};

export const assertMixedModeMismatch = async (): Promise<void> => {
  if (!config.diagnostics.mixedModeGuardEnabled || config.dockerMode) {
    return;
  }

  if (!isLocalAddress(config.database.host)) {
    return;
  }

  const dockerDbHostPort = config.diagnostics.dockerDbHostPort;
  if (!dockerDbHostPort) {
    return;
  }

  const dockerDbPortOpen = await probeTcpPort("127.0.0.1", dockerDbHostPort, 500);
  const dbConfiguredForDockerPort =
    isLocalAddress(config.database.host) && config.database.port === dockerDbHostPort;

  if (dockerDbPortOpen && !dbConfiguredForDockerPort) {
    throw new Error(
      `[preflight] Mixed mode detected: Docker PostgreSQL appears active on 127.0.0.1:${dockerDbHostPort}, but DATABASE_URL points elsewhere. Abort boot.`
    );
  }
};

const resolveUrlPort = (urlValue: string): number => {
  const parsed = new URL(urlValue);
  if (parsed.port) {
    return Number(parsed.port);
  }
  return parsed.protocol === "https:" ? 443 : 80;
};

export const assertApiPortParity = (): void => {
  const configuredApiPort = resolveUrlPort(config.server.publicApiBaseUrl);
  const boundPort = config.server.port;
  if (configuredApiPort === boundPort) {
    return;
  }

  const message =
    `[preflight] API port mismatch: PUBLIC_API_BASE_URL=${config.server.publicApiBaseUrl} ` +
    `resolves to ${configuredApiPort} but PORT=${boundPort}.`;

  if (config.isProduction) {
    throw new Error(`${message} Production boot blocked.`);
  }

  console.warn(`${message} Development boot continues for diagnostics.`);
};

export const assertClusterParity = async (): Promise<void> => {
  if (!config.diagnostics.clusterParityCheckEnabled) {
    return;
  }

  if (!config.redis.enabled) {
    throw new Error(
      "[preflight] CLUSTER_PARITY_CHECK_ENABLED=true requires REDIS_ENABLED=true"
    );
  }

  const key = `${config.redis.namespace}:${config.redis.parityKey}:${config.nodeEnv}`;
  try {
    const current = await redisClient.get(key);
    if (current && current !== configHash) {
      throw new Error(
        "[preflight] Configuration parity hash mismatch across instances. Boot aborted."
      );
    }
    if (!current) {
      await redisClient.set(key, configHash, "EX", 3600);
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("parity hash mismatch")) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[preflight] Cluster parity check failed — Redis unreachable or command failed: ${msg}`
    );
  }
};

export const printStartupDiagnostics = (): void => {
  const corsOrigins = config.cors.origins.join(", ");
  const block = [
    "================ SYSTEM STATE ================",
    `Environment: ${config.nodeEnv}`,
    `Server Port: ${config.server.port}`,
    `Database Host: ${config.database.host}`,
    `Database Port: ${config.database.port}`,
    `Redis Host: ${config.redis.host}`,
    `CORS Origins: ${corsOrigins}`,
    `Docker Mode: ${String(config.dockerMode)}`,
    "Migration Status: verified",
    `Config Hash: ${configHash}`,
    "=============================================",
  ];

  console.log(block.join("\n"));
};

export const assertResourceGuards = (): void => {
  const maxListeners = process.getMaxListeners();
  if (!Number.isFinite(maxListeners) || maxListeners <= 0) {
    throw new Error(
      "[preflight] Resource guard failed: process max listeners must be finite and > 0."
    );
  }

  if (maxListeners > 50) {
    throw new Error(
      `[preflight] Resource guard failed: max listeners (${maxListeners}) exceeds safe threshold (50).`
    );
  }
};
