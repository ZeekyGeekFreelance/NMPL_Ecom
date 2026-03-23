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
    "[dev-profile] Usage: node ./scripts/run-dev-profile.js <neon|localdocker>"
  );
  process.exit(1);
}

const serverRoot = path.resolve(__dirname, "..");
const command = process.platform === "win32" ? "npx.cmd" : "npx";

const run = (args, extraEnv = {}) =>
  new Promise((resolve, reject) => {
    const isWindows = process.platform === "win32";
    const spawnCommand = isWindows ? process.env.ComSpec || "cmd.exe" : command;
    const spawnArgs = isWindows ? ["/d", "/s", "/c", command, ...args] : args;

    const child = spawn(spawnCommand, spawnArgs, {
      cwd: serverRoot,
      env: {
        ...process.env,
        ...extraEnv,
      },
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`[dev-profile] Command ${args.join(" ")} exited via ${signal}`));
        return;
      }
      resolve(code ?? 0);
    });
  });

const start = async () => {
  console.log(
    `[dev-profile] Starting server in ${selectedProfile.label} mode using ${selectedProfile.envFileName}`
  );

  const env = {
    ENV_FILE_NAME: selectedProfile.envFileName,
  };

  const generateExitCode = await run(["prisma", "generate"], env);
  if (generateExitCode !== 0) {
    process.exit(generateExitCode);
  }

  const nodemonExitCode = await run(["nodemon"], env);
  process.exit(nodemonExitCode);
};

start().catch((error) => {
  console.error(
    error instanceof Error ? error.message : `[dev-profile] ${String(error)}`
  );
  process.exit(1);
});
