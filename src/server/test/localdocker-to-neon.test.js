const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const serverRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(serverRoot, "..", "..");
const serverPackage = JSON.parse(
  fs.readFileSync(path.join(serverRoot, "package.json"), "utf8")
);
const rootPackage = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")
);
const migrationScript = fs.readFileSync(
  path.join(serverRoot, "scripts", "migrate-localdocker-to-neon.js"),
  "utf8"
);
const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");

module.exports = [
  {
    name: "server package exposes localdocker to neon migration commands",
    run() {
      assert.equal(
        serverPackage.scripts["db:migrate:localdocker:to:neon:plan"],
        "node ./scripts/migrate-localdocker-to-neon.js --plan"
      );
      assert.equal(
        serverPackage.scripts["db:migrate:localdocker:to:neon"],
        "node ./scripts/migrate-localdocker-to-neon.js --execute"
      );
    },
  },
  {
    name: "root package and docs expose the migration workflow",
    run() {
      assert.equal(
        rootPackage.scripts["db:migrate:localdocker:to:neon:plan"],
        "npm --prefix ./src/server run db:migrate:localdocker:to:neon:plan"
      );
      assert.equal(
        rootPackage.scripts["db:migrate:localdocker:to:neon"],
        "npm --prefix ./src/server run db:migrate:localdocker:to:neon"
      );
      assert.match(readme, /npm run db:migrate:localdocker:to:neon:plan/);
      assert.match(readme, /npm run db:migrate:localdocker:to:neon/);
    },
  },
  {
    name: "migration script restores into Neon DIRECT_URL rather than the pooler",
    run() {
      assert.match(
        migrationScript,
        /Target URL points at a pooled host\. Use Neon DIRECT_URL, not the pooler\./
      );
      assert.match(migrationScript, /pg_dump/);
      assert.match(migrationScript, /pg_restore/);
    },
  },
];
