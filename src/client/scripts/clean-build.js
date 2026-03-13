/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const nextPath = path.resolve(__dirname, "..", ".next");
fs.rmSync(nextPath, { recursive: true, force: true });
console.log("[build-clean] Removed client .next directory.");
