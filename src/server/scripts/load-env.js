/**
 * load-env.js - preload script (-r flag, runs before any TS module)
 *
 * Priority rules:
 *
 * DOCKER_MODE=true:
 *   docker-compose / platform-injected env vars win, EXCEPT when the current
 *   value for a critical connection key (DATABASE_URL, REDIS_URL) is a
 *   localhost/127.0.0.1 address — that's a stale local value that slipped
 *   into the container environment and must be overridden from .env.
 *
 * DOCKER_MODE=false (local dev):
 *   .env is always fully authoritative. Every key is overwritten so stale
 *   system-level env vars (leftover from previous Docker or local Postgres
 *   installs) never shadow the developer's intended values.
 *
 * This resolves the crash loop where DATABASE_URL=localhost:5433 was set as
 * a Windows system env var and silently prevented the server from ever
 * connecting to the Neon cloud database.
 */
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

const nodeEnv = String(process.env.NODE_ENV || "").trim().toLowerCase();
const isDocker = String(process.env.DOCKER_MODE || "").trim().toLowerCase() === "true";
const envFileCandidates = nodeEnv === "production" ? [".env.production"] : [".env"];

// Keys whose current system value will be replaced even in Docker mode when
// that value points to a localhost address — these are always misconfigured
// stale values that must never win over a cloud database URL in .env.
const ALWAYS_OVERRIDE_IF_LOCAL = new Set(["DATABASE_URL", "DIRECT_URL", "REDIS_URL"]);

const isLocalhost = (value) => {
  try {
    const url = new URL(value);
    const h = url.hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "::1";
  } catch {
    return false;
  }
};

for (const filename of envFileCandidates) {
  const envPath = path.resolve(__dirname, "..", filename);
  if (!fs.existsSync(envPath)) continue;

  const parsed = dotenv.parse(fs.readFileSync(envPath, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    const currentValue = process.env[key];
    const isAlreadySet = currentValue !== undefined;

    if (!isAlreadySet) {
      // Not set at all — always write from .env.
      process.env[key] = value;
      continue;
    }

    if (!isDocker) {
      // Local dev: .env always wins. Overwrite everything.
      process.env[key] = value;
      continue;
    }

    // Docker mode: respect injected env, BUT force-override connection keys
    // that are currently pointing at localhost — those are stale local values
    // that were accidentally exported into the environment.
    if (ALWAYS_OVERRIDE_IF_LOCAL.has(key) && isLocalhost(currentValue)) {
      process.env[key] = value;
    }
    // All other keys in Docker mode: keep existing injected value.
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

// In Docker, rewrite any remaining localhost DB addresses to the service name.
if (isDocker) {
  patchDockerDbUrl("DATABASE_URL");
  patchDockerDbUrl("DIRECT_URL");
}

if (process.env.NODE_ENV !== "production") {
  const dbUrl = process.env.DATABASE_URL || "(not set)";
  const host = (() => {
    try {
      return new URL(dbUrl).hostname;
    } catch {
      return dbUrl;
    }
  })();
  const redis = process.env.REDIS_ENABLED || "(not set)";
  const port = process.env.PORT || "(not set)";
  console.log(
    `[load-env] env loaded — DB: ${host} | REDIS_ENABLED: ${redis} | PORT: ${port}`
  );
}
