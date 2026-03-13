/**
 * load-env.js — preload script (-r flag, runs before any TS module)
 *
 * In Docker: environment variables are already injected by docker-compose.
 * Those always take precedence over .env — .env is only a local dev fallback.
 *
 * Outside Docker (plain `npm run dev`): nothing is pre-set, so .env fills
 * everything.
 *
 * Rule: only write a key from .env if it is NOT already in process.env.
 */
const path = require("path");
const fs   = require("fs");
const dotenv = require("dotenv");

const envPath = path.resolve(__dirname, "..", ".env");

if (fs.existsSync(envPath)) {
  const parsed = dotenv.parse(fs.readFileSync(envPath, "utf8"));

  for (const [key, value] of Object.entries(parsed)) {
    // Docker-compose (or any real env) already set this — don't override it.
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const patchDockerDbUrl = (key) => {
  const raw = process.env[key];
  if (!raw) return;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      url.hostname = "db";
      if (!url.port || url.port === "5433") {
        url.port = "5432";
      }
      process.env[key] = url.toString();
    }
  } catch {
    // Ignore malformed URLs; config validation will surface it later.
  }
};

// In Docker, ensure DATABASE_URL points at the service name even if .env
// contains localhost values (Prisma CLI reads .env by default).
if (process.env.DOCKER_MODE === "true") {
  patchDockerDbUrl("DATABASE_URL");
  patchDockerDbUrl("DIRECT_URL");
}

if (process.env.NODE_ENV !== "production") {
  const dbUrl = process.env.DATABASE_URL || "(not set)";
  const host  = (() => { try { return new URL(dbUrl).hostname; } catch { return dbUrl; } })();
  const redis = process.env.REDIS_ENABLED || "(not set)";
  const port  = process.env.PORT           || "(not set)";
  console.log(`[load-env] env loaded — DB: ${host} | REDIS_ENABLED: ${redis} | PORT: ${port}`);
}
