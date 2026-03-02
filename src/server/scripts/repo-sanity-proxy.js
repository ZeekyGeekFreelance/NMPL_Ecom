/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoScript = path.resolve(__dirname, "..", "..", "..", "scripts", "repo-sanity.js");
const packageRoot = path.resolve(__dirname, "..");
const lockfiles = ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"];

const runLocalPackageSanity = () => {
  const packageJsonPath = path.join(packageRoot, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`[repo-sanity] Missing package.json at ${packageJsonPath}`);
  }

  const presentLockfiles = lockfiles.filter((name) =>
    fs.existsSync(path.join(packageRoot, name))
  );

  if (presentLockfiles.length !== 1 || presentLockfiles[0] !== "package-lock.json") {
    throw new Error(
      `[repo-sanity] server package must use only package-lock.json (found: ${presentLockfiles.join(", ") || "none"})`
    );
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  if (!packageJson.engines || typeof packageJson.engines.node !== "string") {
    throw new Error("[repo-sanity] server package.json must define engines.node");
  }

  console.log("[repo-sanity] Root script not available in this build context. Local package sanity passed.");
};

if (fs.existsSync(repoScript)) {
  execSync(`node "${repoScript}"`, {
    stdio: "inherit",
  });
} else {
  runLocalPackageSanity();
}
