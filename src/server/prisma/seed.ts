import { seedDev } from "./seed-dev";
import { importCatalog } from "./import-catalog";

type SeedOrchestratorContext = {
  nodeEnv: string;
  dbEnv: string;
  databaseUrl: string;
  dbHost: string;
};

const PROD_TOKEN_PATTERN = /\bproduction\b/i;

const parseDbHost = (databaseUrl: string): string => {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return "invalid-url";
  }
};

const readContext = (): SeedOrchestratorContext => {
  const nodeEnv = (process.env.NODE_ENV || "development").trim().toLowerCase();
  const dbEnv = (process.env.DB_ENV || "").trim().toLowerCase();
  const databaseUrl = (process.env.DATABASE_URL || "").trim();

  if (!databaseUrl) {
    throw new Error("[seed] DATABASE_URL is required.");
  }

  return {
    nodeEnv,
    dbEnv,
    databaseUrl,
    dbHost: parseDbHost(databaseUrl),
  };
};

const assertOrchestratorGuards = (ctx: SeedOrchestratorContext): void => {
  if (!ctx.dbEnv) {
    throw new Error(
      "[seed] DB_ENV is required. Use DB_ENV=development for dev DB and DB_ENV=production for prod DB."
    );
  }

  if (ctx.nodeEnv === "production" && ctx.dbEnv !== "production") {
    throw new Error(
      `[seed] Guard blocked: NODE_ENV=production requires DB_ENV=production (received '${ctx.dbEnv}').`
    );
  }

  if (ctx.nodeEnv !== "production" && ctx.dbEnv === "production") {
    throw new Error(
      "[seed] Guard blocked: non-production NODE_ENV cannot target DB_ENV=production."
    );
  }

  if (ctx.nodeEnv !== "production" && PROD_TOKEN_PATTERN.test(ctx.databaseUrl)) {
    throw new Error(
      "[seed] Guard blocked: non-production seed detected DATABASE_URL with 'production'."
    );
  }
};

export const runSeedOrchestrator = async (): Promise<void> => {
  const ctx = readContext();

  console.warn(
    `[seed] Orchestrator start | NODE_ENV=${ctx.nodeEnv} DB_ENV=${ctx.dbEnv} DB_HOST=${ctx.dbHost}`
  );

  assertOrchestratorGuards(ctx);

  if (ctx.nodeEnv === "production") {
    console.warn("[seed] Routing to production catalog import.");
    await importCatalog();
    return;
  }

  console.warn("[seed] Routing to development seed.");
  await seedDev();
};

if (require.main === module) {
  runSeedOrchestrator().catch((error) => {
    console.error("[seed] Failed:", error);
    process.exit(1);
  });
}
