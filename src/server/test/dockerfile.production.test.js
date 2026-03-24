const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const dockerfilePath = path.resolve(__dirname, "..", "Dockerfile.production");
const dockerfile = fs.readFileSync(dockerfilePath, "utf8");

module.exports = [
  {
    name: "production Dockerfile healthcheck targets only the real health endpoint",
    run() {
      assert.match(
        dockerfile,
        /HEALTHCHECK[\s\S]*curl -f http:\/\/localhost:5000\/health \|\| exit 1/
      );
      assert.doesNotMatch(dockerfile, /curl -f http:\/\/localhost:5000\/ \|\| exit 1/);
    },
  },
  {
    name: "production Dockerfile does not fall back to the diagnostic server",
    run() {
      const cmdSection = dockerfile
        .split("\n")
        .filter((line) => line.startsWith("CMD ") || line.startsWith("# Start"))
        .join("\n");

      assert.doesNotMatch(cmdSection, /simple-health\.js/);
    },
  },
];
