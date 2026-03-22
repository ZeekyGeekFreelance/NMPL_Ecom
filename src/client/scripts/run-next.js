/* eslint-disable no-console */
const path = require("path");
const { spawn } = require("child_process");
const { cleanBuildDir } = require("./clean-build");

const mode = process.argv[2];
const extraArgs = process.argv.slice(3);

const distDirByMode = {
  dev: ".next-dev",
  build: ".next-prod",
  start: ".next-prod",
};

if (!mode || !distDirByMode[mode]) {
  console.error(
    "[next-runner] Usage: node ./scripts/run-next.js <dev|build|start> [next args...]"
  );
  process.exit(1);
}

const distDir = distDirByMode[mode];

if (mode === "dev" || mode === "build") {
  cleanBuildDir(distDir);
}

const nextBinPath = require.resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBinPath, mode, ...extraArgs], {
  cwd: path.resolve(__dirname, ".."),
  env: {
    ...process.env,
    NEXT_DIST_DIR: distDir,
  },
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`[next-runner] Failed to start next ${mode}.`, error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`[next-runner] next ${mode} exited due to signal ${signal}.`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});
