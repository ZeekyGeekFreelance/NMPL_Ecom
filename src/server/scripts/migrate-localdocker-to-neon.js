/* eslint-disable no-console */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const dotenv = require("dotenv");

const cliArgs = new Set(process.argv.slice(2));
const shouldExecute = cliArgs.has("--execute");
const keepDump = cliArgs.has("--keep-dump");

const serverRoot = path.resolve(__dirname, "..");
const sourceEnvPath = fs.existsSync(path.join(serverRoot, ".env.localdocker"))
  ? path.join(serverRoot, ".env.localdocker")
  : path.join(serverRoot, ".env.localdocker.example");
const targetEnvPath = path.join(serverRoot, ".env");

const readEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`[migrate-localdocker-to-neon] Missing env file: ${filePath}`);
  }

  return dotenv.parse(fs.readFileSync(filePath, "utf8"));
};

const asUrl = (label, raw) => {
  try {
    return new URL(String(raw || "").trim());
  } catch (error) {
    throw new Error(
      `[migrate-localdocker-to-neon] ${label} is not a valid PostgreSQL URL: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};

const isLocalHost = (host) => {
  const normalized = String(host || "").trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
};

const redactUrl = (value) => {
  const url = new URL(value);
  if (url.password) {
    url.password = "******";
  }
  return url.toString();
};

const ensureDockerClient = () => {
  const result = spawnSync("docker", ["--version"], {
    stdio: "ignore",
    cwd: serverRoot,
  });

  if (result.error || result.status !== 0) {
    throw new Error(
      "[migrate-localdocker-to-neon] Docker CLI is required. Start Docker Desktop and retry."
    );
  }
};

const run = (command, args, label) => {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    cwd: serverRoot,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `[migrate-localdocker-to-neon] ${label} failed with exit code ${result.status ?? "unknown"}`
    );
  }
};

const targetEnv = readEnvFile(targetEnvPath);
const sourceOverlay = readEnvFile(sourceEnvPath);
const sourceEnv = {
  ...targetEnv,
  ...sourceOverlay,
};

const sourceRaw = sourceEnv.DIRECT_URL || sourceEnv.DATABASE_URL;
const targetRaw = targetEnv.DIRECT_URL || targetEnv.DATABASE_URL;

if (!sourceRaw) {
  throw new Error(
    `[migrate-localdocker-to-neon] Source local Docker database URL is missing in ${sourceEnvPath}`
  );
}

if (!targetRaw) {
  throw new Error(
    `[migrate-localdocker-to-neon] Target Neon DIRECT_URL is missing in ${targetEnvPath}`
  );
}

const sourceUrl = asUrl("source local Docker URL", sourceRaw);
const targetUrl = asUrl("target Neon direct URL", targetRaw);

if (targetUrl.hostname.toLowerCase().includes("pooler")) {
  throw new Error(
    "[migrate-localdocker-to-neon] Target URL points at a pooled host. Use Neon DIRECT_URL, not the pooler."
  );
}

if (!isLocalHost(sourceUrl.hostname)) {
  console.warn(
    `[migrate-localdocker-to-neon] Warning: source host '${sourceUrl.hostname}' is not localhost. Continuing anyway.`
  );
}

if (isLocalHost(targetUrl.hostname)) {
  throw new Error(
    "[migrate-localdocker-to-neon] Target URL is localhost. Refusing to run because the destination must be Neon."
  );
}

const dockerSourceUrl = new URL(sourceUrl.toString());
if (isLocalHost(dockerSourceUrl.hostname)) {
  dockerSourceUrl.hostname = "host.docker.internal";
}

const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "nmpl-localdocker-to-neon-")
);
const dumpFileName = "localdocker.dump";
const dumpFilePath = path.join(tempDir, dumpFileName);

const dumpArgs = [
  "run",
  "--rm",
  "--add-host",
  "host.docker.internal:host-gateway",
  "-v",
  `${tempDir}:/backup`,
  "postgres:15",
  "pg_dump",
  "--format=custom",
  "--no-owner",
  "--no-privileges",
  `--dbname=${dockerSourceUrl.toString()}`,
  "--file",
  `/backup/${dumpFileName}`,
];

const restoreArgs = [
  "run",
  "--rm",
  "-v",
  `${tempDir}:/backup`,
  "postgres:15",
  "pg_restore",
  "--clean",
  "--if-exists",
  "--single-transaction",
  "--exit-on-error",
  "--no-owner",
  "--no-privileges",
  `--dbname=${targetUrl.toString()}`,
  `/backup/${dumpFileName}`,
];

console.log("[migrate-localdocker-to-neon] Source:", redactUrl(dockerSourceUrl.toString()));
console.log("[migrate-localdocker-to-neon] Target:", redactUrl(targetUrl.toString()));
console.log(
  "[migrate-localdocker-to-neon] Safety note: do not promote seeded demo accounts into production Neon. Use a disposable Neon branch first if your local DB still contains superadmin@example.com / admin@example.com / user@example.com demo data."
);

if (!shouldExecute) {
  console.log("");
  console.log("[migrate-localdocker-to-neon] Dry run complete.");
  console.log("[migrate-localdocker-to-neon] This command will:");
  console.log("  1. export the current local Docker Postgres state to a temporary custom-format dump");
  console.log("  2. restore that dump into the Neon DIRECT_URL target");
  console.log("  3. overwrite conflicting target objects with --clean --if-exists");
  console.log("");
  console.log(
    "[migrate-localdocker-to-neon] Execute with: npm run db:migrate:localdocker:to:neon"
  );
  if (!keepDump) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  process.exit(0);
}

try {
  ensureDockerClient();
  run("docker", dumpArgs, "local Docker export");
  run("docker", restoreArgs, "Neon restore");
  console.log(
    `[migrate-localdocker-to-neon] Migration complete. Dump file: ${dumpFilePath}`
  );
  if (!keepDump) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log("[migrate-localdocker-to-neon] Temporary dump removed.");
  }
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : `[migrate-localdocker-to-neon] ${String(error)}`
  );
  console.error(
    `[migrate-localdocker-to-neon] Temporary dump retained at ${dumpFilePath} for inspection.`
  );
  process.exit(1);
}
