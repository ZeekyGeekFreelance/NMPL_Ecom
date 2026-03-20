/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const nextPath = path.resolve(__dirname, "..", ".next");
const RM_OPTIONS = {
  recursive: true,
  force: true,
  maxRetries: 20,
  retryDelay: 250,
};

const removeDirectoryContents = (directoryPath) => {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

  entries.forEach((entry) => {
    fs.rmSync(path.join(directoryPath, entry.name), RM_OPTIONS);
  });
};

if (!fs.existsSync(nextPath)) {
  console.log("[build-clean] No client .next directory to clear.");
  process.exit(0);
}

try {
  const nextStats = fs.lstatSync(nextPath);
  if (!nextStats.isDirectory()) {
    throw new Error("[build-clean] Expected .next to be a directory.");
  }

  removeDirectoryContents(nextPath);
  console.log("[build-clean] Cleared client .next directory contents.");
} catch (error) {
  const errorCode =
    error && typeof error === "object" && "code" in error ? ` (${error.code})` : "";
  console.error(`[build-clean] Failed to clear client .next directory${errorCode}.`);
  console.error(
    "[build-clean] Stop any running Next.js process that is still using `.next`, then retry."
  );
  throw error;
}
