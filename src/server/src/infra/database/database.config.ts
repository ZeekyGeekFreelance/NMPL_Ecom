import { PrismaClient } from "@prisma/client";
import { config } from "@/config";
import { recordQueryMetric } from "@/shared/observability/requestMetrics";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: config.database.url,
    },
  },
});

// Register query telemetry in all environments.
prisma.$use(async (params, next) => {
  const startedAt = performance.now();
  const result = await next(params);
  const durationMs = performance.now() - startedAt;

  recordQueryMetric({
    model: params.model || "raw",
    action: params.action,
    durationMs,
  });

  return result;
});

// ── Prisma error codes that indicate misconfiguration, not transient
// connectivity problems.  These should cause an immediate fast-fail so the
// operator gets a clear error message rather than a silent retry loop.
const FATAL_PRISMA_CODES = new Set([
  "P1010", // User denied access to the database
  "P1011", // TLS / SSL error
]);

const isFatalDbError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const code = (error as any).errorCode ?? (error as any).code ?? "";
  return FATAL_PRISMA_CODES.has(String(code));
};

const isFatalAuthError = (error: unknown): boolean => {
  const msg = error instanceof Error ? error.message : String(error);
  // "Authentication failed" / "password authentication failed" from Postgres
  // are configuration errors — retrying will never fix them.
  return /authentication failed|Access denied|password/i.test(msg) &&
    !/timeout/i.test(msg);
};

export const connectDB = async (): Promise<void> => {
  // In production give up after ~10 minutes (20 attempts × up-to-30 s each).
  // In development keep retrying effectively forever so Docker / local
  // restarts don't require a manual server restart once the DB comes up.
  const MAX_ATTEMPTS = config.isProduction ? 20 : 300;
  const INITIAL_DELAY_MS = 1_000;
  const MAX_DELAY_MS = 30_000;

  console.log("[db] DATABASE CONNECTING...");

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await prisma.$connect();
      console.log("[db] ✅ DATABASE CONNECTED");
      return;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      // Fast-fail on credential / TLS misconfiguration — retrying is pointless.
      if (isFatalDbError(error) || isFatalAuthError(error)) {
        console.error(`[db] ❌ Fatal database error (will not retry): ${msg}`);
        throw error;
      }

      const isLast = attempt === MAX_ATTEMPTS;
      if (isLast) {
        console.error(`[db] ❌ All ${MAX_ATTEMPTS} connection attempts exhausted. Last error: ${msg}`);
        throw error;
      }

      // Exponential backoff with jitter, capped at MAX_DELAY_MS.
      const exponent = Math.min(attempt - 1, 5); // cap exponent at 2^5 = 32 s
      const base = INITIAL_DELAY_MS * Math.pow(2, exponent);
      const delay = Math.min(MAX_DELAY_MS, base) + Math.random() * 500;
      console.warn(
        `[db] Connection attempt ${attempt}/${MAX_ATTEMPTS} failed (${msg}). Retrying in ${Math.round(delay)}ms…`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[db] disconnectDB failed: ${msg}`);
    throw err;
  }
};

export const pingDB = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};

export default prisma;
