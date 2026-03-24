const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const clientRoot = path.resolve(__dirname, "..");
const runtimeEnvSource = fs.readFileSync(
  path.join(clientRoot, "app", "lib", "runtimeEnv.ts"),
  "utf8"
);

module.exports = [
  {
    name: "runtime env aligns local production preview API host with the browser host",
    run() {
      assert.match(
        runtimeEnvSource,
        /nodeEnv === "development" \|\| ALLOW_LOCAL_PRODUCTION_PREVIEW/
      );
      assert.match(
        runtimeEnvSource,
        /resolvedUrl\.hostname = browserHost/
      );
    },
  },
];
