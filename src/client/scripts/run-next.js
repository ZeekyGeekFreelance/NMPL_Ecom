/* eslint-disable no-console */
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { cleanBuildDir } = require("./clean-build");

const mode = process.argv[2];
const rawExtraArgs = process.argv.slice(3);
const profileArg = rawExtraArgs.find((arg) => arg.startsWith("--profile="));
const profile = String(profileArg || "")
  .slice("--profile=".length)
  .trim()
  .toLowerCase();
const extraArgs = rawExtraArgs.filter((arg) => arg !== profileArg);

const distDirByMode = {
  dev: ".next-dev",
  build: ".next",
  start: ".next",
};

if (!mode || !distDirByMode[mode]) {
  console.error(
    "[next-runner] Usage: node ./scripts/run-next.js <dev|build|start> [next args...]"
  );
  process.exit(1);
}

const projectRoot = path.resolve(__dirname, "..");
const PREVIEW_ENV_KEYS = [
  "NEXT_PUBLIC_API_URL",
  "INTERNAL_API_URL",
  "NEXT_PUBLIC_PLATFORM_NAME",
  "NEXT_PUBLIC_SUPPORT_EMAIL",
  "NEXT_PUBLIC_ENABLE_NATIVE_CONFIRM",
  "NEXT_PUBLIC_DEALER_CATALOG_POLL_MS",
];

const parseEnvFile = (content) => {
  const parsed = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
};

const loadLocalPreviewEnv = () => {
  if (profile !== "localpreview") {
    return {};
  }

  const layered = {};
  for (const filename of [".env", ".env.local"]) {
    const filePath = path.join(projectRoot, filename);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const parsed = parseEnvFile(fs.readFileSync(filePath, "utf8"));
    for (const key of PREVIEW_ENV_KEYS) {
      if (typeof parsed[key] === "string" && parsed[key].trim().length > 0) {
        layered[key] = parsed[key].trim();
      }
    }
  }

  layered.ALLOW_LOCAL_PRODUCTION_PREVIEW = "true";
  layered.NEXT_PUBLIC_ALLOW_LOCAL_PRODUCTION_PREVIEW = "true";
  return layered;
};

const distDir = distDirByMode[mode];

if (mode === "dev" || mode === "build") {
  cleanBuildDir(distDir);
}

const nextBinPath = require.resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBinPath, mode, ...extraArgs], {
  cwd: projectRoot,
  env: {
    ...process.env,
    ...loadLocalPreviewEnv(),
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
