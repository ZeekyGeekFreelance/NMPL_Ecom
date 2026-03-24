/* eslint-disable no-console */
const path = require("path");
const { spawn } = require("child_process");

const profile = String(process.argv[2] || "").trim().toLowerCase();

const profileConfig = {
  neon: {
    envFileName: ".env",
    label: "Neon",
  },
  localdocker: {
    envFileName: ".env.localdocker",
    label: "Local Docker",
  },
};

const selectedProfile = profileConfig[profile];

if (!selectedProfile) {
  console.error(
    "[start-profile] Usage: node ./scripts/run-start-profile.js <neon|localdocker>"
  );
  process.exit(1);
}

const serverRoot = path.resolve(__dirname, "..");
const nodeArgs = [
  "-r",
  "./scripts/load-env.js",
  "-r",
  "module-alias/register",
  "dist/server.js",
];

const child = spawn(process.execPath, nodeArgs, {
  cwd: serverRoot,
  env: {
    ...process.env,
    NODE_ENV: "production",
    ENV_FILE_NAME: selectedProfile.envFileName,
    ALLOW_LOCAL_PRODUCTION_PREVIEW: "true",
  },
  stdio: "inherit",
});

console.log(
  `[start-profile] Starting built server in ${selectedProfile.label} mode using ${selectedProfile.envFileName}`
);

child.on("error", (error) => {
  console.error(
    error instanceof Error ? error.message : `[start-profile] ${String(error)}`
  );
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`[start-profile] Process exited via ${signal}`);
    process.exit(1);
  }

  process.exit(code ?? 0);
});
