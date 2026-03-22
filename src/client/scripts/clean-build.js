/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const RM_OPTIONS = {
  recursive: true,
  force: true,
  maxRetries: 20,
  retryDelay: 250,
};

const resolveDistDirName = (explicitDir) => {
  const rawValue = explicitDir ?? process.env.NEXT_DIST_DIR ?? ".next";
  const trimmedValue = String(rawValue || "").trim();
  return trimmedValue || ".next";
};

const removeDirectoryContents = (directoryPath) => {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

  entries.forEach((entry) => {
    fs.rmSync(path.join(directoryPath, entry.name), RM_OPTIONS);
  });
};

const cleanBuildDir = (explicitDir) => {
  const distDirName = resolveDistDirName(explicitDir);
  const nextPath = path.resolve(__dirname, "..", distDirName);

  if (!fs.existsSync(nextPath)) {
    console.log(`[build-clean] No client ${distDirName} directory to clear.`);
    return;
  }

  try {
    const nextStats = fs.lstatSync(nextPath);
    if (!nextStats.isDirectory()) {
      throw new Error(`[build-clean] Expected ${distDirName} to be a directory.`);
    }

    removeDirectoryContents(nextPath);
    console.log(`[build-clean] Cleared client ${distDirName} directory contents.`);
  } catch (error) {
    const errorCode =
      error && typeof error === "object" && "code" in error ? ` (${error.code})` : "";
    console.error(`[build-clean] Failed to clear client ${distDirName}${errorCode}.`);
    console.error(
      `[build-clean] Stop any running Next.js process that is still using \`${distDirName}\`, then retry.`
    );
    throw error;
  }
};

if (require.main === module) {
  cleanBuildDir(process.argv[2]);
}

module.exports = {
  cleanBuildDir,
  resolveDistDirName,
};
