const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const serverRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(serverRoot, "..", "..");
const productionEnvTemplate = fs.readFileSync(
  path.join(serverRoot, ".env.production.example"),
  "utf8"
);
const configSource = fs.readFileSync(
  path.join(serverRoot, "src", "config", "index.ts"),
  "utf8"
);
const envSourceOfTruth = fs.readFileSync(
  path.join(repoRoot, "ENVIRONMENT_SOURCE_OF_TRUTH.md"),
  "utf8"
);

module.exports = [
  {
    name: "production env template requires modern auth and database contract keys",
    run() {
      assert.match(productionEnvTemplate, /^DIRECT_URL=/m);
      assert.match(productionEnvTemplate, /^SUPERADMIN_RESET_SECRET=/m);
      assert.doesNotMatch(productionEnvTemplate, /^SESSION_SECRET=/m);
    },
  },
  {
    name: "config source enforces production DIRECT_URL and cookie-domain guards",
    run() {
      assert.match(
        configSource,
        /Production requires DIRECT_URL so Prisma maintenance operations bypass pooled connections\./
      );
      assert.match(
        configSource,
        /Production COOKIE_DOMAIN must start with '\.'/ 
      );
      assert.match(
        configSource,
        /Production boot blocked: SUPERADMIN_RESET_SECRET must be at least 32 characters\./
      );
      assert.match(
        configSource,
        /cookieSecure: isProduction && !allowLocalProductionPreview/
      );
    },
  },
  {
    name: "environment source of truth removes stale session auth env and documents DIRECT_URL",
    run() {
      assert.match(envSourceOfTruth, /`SESSION_SECRET`/);
      assert.match(envSourceOfTruth, /What is no longer part of the supported env surface:/);
      assert.match(envSourceOfTruth, /`DIRECT_URL` must be the direct maintenance connection string used by Prisma migrations/);
    },
  },
];
