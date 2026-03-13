/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const distPath = path.resolve(__dirname, "..", "dist");
fs.rmSync(distPath, { recursive: true, force: true });
console.log("[build-clean] Removed server dist directory.");
