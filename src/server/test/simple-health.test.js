const assert = require("node:assert/strict");
const path = require("node:path");
const { spawn } = require("node:child_process");

const serverRoot = path.resolve(__dirname, "..");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForHealth = async (url, attempts = 40) => {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      return response;
    } catch (error) {
      lastError = error;
      await wait(100);
    }
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
};

module.exports = [
  {
    name: "diagnostic health server returns 503 and explicit fallback status",
    async run() {
      const port = String(5600 + Math.floor(Math.random() * 500));
      const child = spawn(process.execPath, ["scripts/simple-health.js"], {
        cwd: serverRoot,
        env: {
          ...process.env,
          PORT: port,
        },
        stdio: "ignore",
      });

      try {
        const response = await waitForHealth(`http://127.0.0.1:${port}/health`);
        const payload = await response.json();

        assert.equal(response.status, 503);
        assert.equal(payload.status, "diagnostic_fallback");
        assert.match(payload.message, /main API failed to boot/i);
      } finally {
        child.kill("SIGTERM");
        await new Promise((resolve) => child.once("exit", () => resolve()));
      }
    },
  },
];
