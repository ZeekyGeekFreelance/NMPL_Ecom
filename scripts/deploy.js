#!/usr/bin/env node

const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SERVER_DIR = path.join(ROOT, "src", "server");
const CLIENT_DIR = path.join(ROOT, "src", "client");
const PROD_ENV = path.join(SERVER_DIR, ".env.production");
const API_URL = String(process.env.PRODUCTION_API_URL || "https://api.nmpl.in").replace(
  /\/+$/,
  ""
);
const FRONTEND_URL = String(
  process.env.PRODUCTION_FRONTEND_URL || "https://nmpl.in"
).replace(/\/+$/, "");

const baseEnv = {
  ...process.env,
  HUSKY: "0",
  NEXT_TELEMETRY_DISABLED: "1",
  SCARF_ANALYTICS: "false",
};

const run = (command, cwd = ROOT, label = command, env = baseEnv) => {
  console.log(`\n[run] ${label}`);
  try {
    execSync(command, {
      cwd,
      env,
      stdio: "inherit",
      shell: true,
    });
  } catch {
    console.error(`\n[fail] ${label}`);
    process.exit(1);
  }
};

const requireBinary = (binary, installHint) => {
  const result = spawnSync(binary, ["--version"], {
    env: baseEnv,
    shell: true,
    stdio: "ignore",
  });

  if (result.status === 0) {
    return;
  }

  console.error(`\n[fail] Missing required CLI: ${binary}`);
  console.error(`       Install/login hint: ${installHint}`);
  process.exit(1);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      "user-agent": "nmpl-deploy-script",
    },
  });

  const body = await response.text();
  let parsedBody = null;

  if (body.trim()) {
    try {
      parsedBody = JSON.parse(body);
    } catch {
      parsedBody = null;
    }
  }

  return {
    status: response.status,
    body,
    json: parsedBody,
  };
};

const clientBuildEnv = {
  ...baseEnv,
  NODE_ENV: "production",
  INTERNAL_API_URL: `${API_URL}/api/v1`,
  NEXT_PUBLIC_API_URL: `${API_URL}/api/v1`,
  NEXT_PUBLIC_ENABLE_NATIVE_CONFIRM: "false",
  NEXT_PUBLIC_PLATFORM_NAME: process.env.NEXT_PUBLIC_PLATFORM_NAME || "NMPL",
  NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@nmpl.in",
};

const main = async () => {
  console.log("[deploy] Supported production target: Railway (API) + Vercel (client)");

  if (!fs.existsSync(PROD_ENV)) {
    console.error(`\n[fail] Missing ${PROD_ENV}`);
    console.error("       Run: node scripts/setup-production-env.js");
    process.exit(1);
  }

  requireBinary("railway", "npm install -g @railway/cli && railway login");
  requireBinary("vercel", "npm install -g vercel && vercel login");

  run("node ./scripts/repo-sanity.js", ROOT, "Repository sanity");

  run("npm ci --prefer-offline", SERVER_DIR, "Install server dependencies");
  run("npx prisma generate", SERVER_DIR, "Generate Prisma client");
  run("npm run build", SERVER_DIR, "Build server");

  run("npm ci --prefer-offline", CLIENT_DIR, "Install client dependencies");
  run(
    "npm run env:check -- --production",
    CLIENT_DIR,
    "Validate client production env",
    clientBuildEnv
  );
  run("npm run build", CLIENT_DIR, "Build client", clientBuildEnv);

  run("node ./scripts/check-licenses.js", ROOT, "Check production licenses");
  run("npm audit --audit-level=high", ROOT, "Audit root dependencies");
  run("npm audit --audit-level=high", SERVER_DIR, "Audit server dependencies");
  run("npm audit --audit-level=high", CLIENT_DIR, "Audit client dependencies");

  run("railway up --detach", SERVER_DIR, "Deploy server to Railway");

  console.log("\n[wait] Waiting 45 seconds for the Railway deployment to boot");
  await sleep(45_000);

  run(
    "railway run npx prisma migrate deploy",
    SERVER_DIR,
    "Run production Prisma migrations"
  );

  console.log(`\n[wait] Polling ${API_URL}/health`);
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      const result = await fetchJson(`${API_URL}/health`);
      const healthy = result.status === 200 && result.json?.healthy === true;
      console.log(
        `[health] attempt ${attempt}/20 status=${result.status} healthy=${String(healthy)}`
      );
      if (healthy) {
        break;
      }
    } catch (error) {
      console.log(
        `[health] attempt ${attempt}/20 failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    if (attempt === 20) {
      console.error("\n[fail] API health check did not pass in time");
      process.exit(1);
    }

    await sleep(15_000);
  }

  run("vercel --prod --yes", CLIENT_DIR, "Deploy client to Vercel");

  try {
    const frontendResult = await fetchJson(FRONTEND_URL);
    console.log(`[smoke] frontend ${FRONTEND_URL} -> ${frontendResult.status}`);
  } catch (error) {
    console.warn(
      `[warn] Frontend smoke test failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  console.log("\n[done] Production deploy completed");
  console.log(`[done] Frontend: ${FRONTEND_URL}`);
  console.log(`[done] API: ${API_URL}`);
  console.log(`[done] Health: ${API_URL}/health`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
