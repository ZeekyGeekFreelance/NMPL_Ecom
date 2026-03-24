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
const scriptSource = fs.readFileSync(
  path.join(serverRoot, "scripts", "bootstrap-privileged-user.js"),
  "utf8"
);
const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");

module.exports = [
  {
    name: "bootstrap script is exposed through package scripts",
    run() {
      assert.equal(
        serverPackage.scripts["bootstrap:privileged"],
        "node ./scripts/bootstrap-privileged-user.js"
      );
      assert.equal(
        rootPackage.scripts["bootstrap:privileged"],
        "npm --prefix ./src/server run bootstrap:privileged --"
      );
    },
  },
  {
    name: "bootstrap script only allows privileged roles and forces first-login rotation",
    run() {
      assert.match(scriptSource, /Role must be SUPERADMIN or ADMIN/);
      assert.match(scriptSource, /mustChangePassword: true/);
      assert.match(scriptSource, /Refusing to overwrite or promote an existing account/);
    },
  },
  {
    name: "readme documents how to bootstrap first privileged users in neon",
    run() {
      assert.match(readme, /npm run bootstrap:privileged -- SUPERADMIN/);
      assert.match(readme, /Public registration never creates those roles/);
    },
  },
];
