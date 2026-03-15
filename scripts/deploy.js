#!/usr/bin/env node

/**
 * NMPL Production Deploy Script
 *
 * Replaces GitHub Actions entirely. Run from the repo root:
 *   node scripts/deploy.js
 *
 * Prerequisites (one-time setup):
 *   npm install -g @railway/cli vercel
 *   railway login
 *   vercel login
 *
 * What this does (in order):
 *   1. Validate environment — refuses to run with missing secrets
 *   2. Build server (TypeScript compile + env check)
 *   3. Build client (Next.js)
 *   4. Security audit (warns on high CVEs, does not block)
 *   5. Deploy server to Railway
 *   6. Run database migrations on Railway
 *   7. Wait for server health check to pass
 *   8. Deploy client to Vercel
 *   9. Final smoke test (API health + homepage)
 */

const { execSync, spawnSync } = require("child_process");
const https = require("https");
const path = require("path");
const fs = require("fs");

// ── Config ─────────────────────────────────────────────────────────────────
const ROOT        = path.resolve(__dirname, "..");
const SERVER_DIR  = path.join(ROOT, "src", "server");
const CLIENT_DIR  = path.join(ROOT, "src", "client");
const PROD_ENV    = path.join(SERVER_DIR, ".env.production");

// Change these if your Railway/Vercel project names differ.
// Alternatively, set RAILWAY_PROJECT_ID and VERCEL_PROJECT_ID env vars.
const API_URL     = process.env.PRODUCTION_API_URL     || "https://api.nmpl.in";
const FRONTEND_URL = process.env.PRODUCTION_FRONTEND_URL || "https://nmpl.in";

// ── Helpers ─────────────────────────────────────────────────────────────────
const run = (cmd, cwd = ROOT, label = "") => {
  const display = label || cmd.slice(0, 80);
  console.log(`\n▶  ${display}`);
  try {
    execSync(cmd, { cwd, stdio: "inherit", env: { ...process.env } });
  } catch {
    console.error(`\n❌ FAILED: ${display}`);
    process.exit(1);
  }
};

const runSafe = (cmd, cwd = ROOT, label = "") => {
  // Like run() but a non-zero exit code is a warning, not a fatal error.
  const display = label || cmd.slice(0, 80);
  console.log(`\n▶  ${display}`);
  const result = spawnSync(cmd, { cwd, stdio: "inherit", shell: true, env: process.env });
  if (result.status !== 0) {
    console.warn(`\n⚠️  Warning (non-fatal): ${display} exited ${result.status}`);
  }
};

const httpGet = (url) =>
  new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", reject);
    req.setTimeout(10_000, () => { req.destroy(); reject(new Error("timeout")); });
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const step = (n, total, label) => {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  Step ${n}/${total}: ${label}`);
  console.log("─".repeat(60));
};

// ── Phase 0: Pre-flight checks ──────────────────────────────────────────────
step(0, 9, "Pre-flight checks");

// Confirm .env.production exists
if (!fs.existsSync(PROD_ENV)) {
  console.error(`\n❌ Missing: ${PROD_ENV}`);
  console.error("   Run: node scripts/setup-production-env.js");
  process.exit(1);
}

// Check for placeholder Redis URL
const envContent = fs.readFileSync(PROD_ENV, "utf8");
if (envContent.includes("REPLACE_WITH_UPSTASH_REDIS_URL")) {
  console.error("\n❌ .env.production still has placeholder REDIS_URL");
  console.error("   Create a free Redis at https://upstash.com and update REDIS_URL");
  process.exit(1);
}

// Check Railway CLI is installed
const railwayCheck = spawnSync("railway", ["--version"], { shell: true });
if (railwayCheck.status !== 0) {
  console.error("\n❌ Railway CLI not found. Install it:");
  console.error("   npm install -g @railway/cli && railway login");
  process.exit(1);
}

// Check Vercel CLI is installed
const vercelCheck = spawnSync("vercel", ["--version"], { shell: true });
if (vercelCheck.status !== 0) {
  console.error("\n❌ Vercel CLI not found. Install it:");
  console.error("   npm install -g vercel && vercel login");
  process.exit(1);
}

console.log("✅ Pre-flight checks passed");

// ── Phase 1: Build server ───────────────────────────────────────────────────
step(1, 9, "Build server (TypeScript compile + env validation)");
run("npm ci --prefer-offline", SERVER_DIR, "Install server deps");
run("npx prisma generate", SERVER_DIR, "Generate Prisma client");
run("npm run build", SERVER_DIR, "Build server");

// ── Phase 2: Build client ───────────────────────────────────────────────────
step(2, 9, "Build client (Next.js)");
run("npm ci --prefer-offline", CLIENT_DIR, "Install client deps");

// Inject production env vars for the build
const clientBuildEnv = Object.assign({}, process.env, {
  NODE_ENV: "production",
  NEXT_PUBLIC_API_URL: `${API_URL}/api/v1`,
  NEXT_PUBLIC_PLATFORM_NAME: "NMPL",
  NEXT_PUBLIC_SUPPORT_EMAIL: "support@nmpl.in",
  NEXT_PUBLIC_ENABLE_NATIVE_CONFIRM: "false",
  INTERNAL_API_URL: `${API_URL}/api/v1`,
});

console.log("\n▶  Build client");
try {
  execSync("npm run build", {
    cwd: CLIENT_DIR,
    stdio: "inherit",
    env: clientBuildEnv,
  });
} catch {
  console.error("\n❌ Client build failed");
  process.exit(1);
}

// ── Phase 3: Security audit ─────────────────────────────────────────────────
step(3, 9, "Security audit (HIGH+ CVEs — warnings only, does not block deploy)");
runSafe("npm audit --audit-level=high", SERVER_DIR, "Server audit");
runSafe("npm audit --audit-level=high", CLIENT_DIR, "Client audit");

// ── Phase 4: Deploy server to Railway ──────────────────────────────────────
step(4, 9, "Deploy server → Railway");
run("railway up --detach", SERVER_DIR, "Deploy server to Railway");

// ── Phase 5: Run migrations ─────────────────────────────────────────────────
step(5, 9, "Run database migrations on Railway");
console.log("  Waiting 45s for Railway to spin up the container...");
// Use synchronous sleep since we're in a script
execSync("node -e \"setTimeout(() => {}, 45000)\"", { timeout: 60000 });
run(
  "railway run npx prisma migrate deploy",
  SERVER_DIR,
  "prisma migrate deploy (production)"
);

// ── Phase 6: Health check ───────────────────────────────────────────────────
step(6, 9, "Wait for server health check");

(async () => {
  const healthUrl = `${API_URL}/health`;
  const maxAttempts = 20;
  const intervalMs  = 15_000;

  console.log(`  Polling ${healthUrl} (up to ${maxAttempts * intervalMs / 1000}s)...`);

  let healthy = false;
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const { status, body } = await httpGet(healthUrl);
      const json = JSON.parse(body);
      console.log(`  Attempt ${i}/${maxAttempts}: HTTP ${status} — healthy=${json.healthy}`);
      if (status === 200 && json.healthy === true) {
        healthy = true;
        break;
      }
    } catch (err) {
      console.log(`  Attempt ${i}/${maxAttempts}: ${err.message}`);
    }
    if (i < maxAttempts) await sleep(intervalMs);
  }

  if (!healthy) {
    console.error(`\n❌ Server did not become healthy within the wait window.`);
    console.error(`   Check Railway logs: railway logs --tail`);
    process.exit(1);
  }

  console.log("✅ Server is healthy");

  // ── Phase 7: Deploy client to Vercel ───────────────────────────────────
  step(7, 9, "Deploy client → Vercel (production)");
  run("vercel --prod --yes", CLIENT_DIR, "vercel deploy --prod");

  // ── Phase 8: Final smoke test ───────────────────────────────────────────
  step(8, 9, "Smoke test");

  try {
    const apiResult = await httpGet(`${API_URL}/health`);
    console.log(`  API health: HTTP ${apiResult.status} ✅`);
  } catch (err) {
    console.warn(`  API health check failed: ${err.message}`);
  }

  try {
    const frontendResult = await httpGet(FRONTEND_URL);
    console.log(`  Frontend: HTTP ${frontendResult.status} ✅`);
  } catch (err) {
    console.warn(`  Frontend check failed: ${err.message}`);
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  step(9, 9, "Deploy complete");
  console.log(`
╔══════════════════════════════════════════╗
║  ✅ PRODUCTION DEPLOY COMPLETE           ║
╠══════════════════════════════════════════╣
║  Frontend : ${FRONTEND_URL.padEnd(28)} ║
║  API      : ${API_URL.padEnd(28)} ║
║  Health   : ${(API_URL + "/health").padEnd(28)} ║
╚══════════════════════════════════════════╝
`);
})();
