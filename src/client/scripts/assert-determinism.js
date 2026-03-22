/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const mode = process.argv[2] || "pre";
const isVercelRuntime =
  String(process.env.VERCEL || "").trim() === "1" ||
  String(process.env.VERCEL || "").trim().toLowerCase() === "true";
const requestedDistDirName = (process.argv[3] || process.env.NEXT_DIST_DIR || ".next").trim() || ".next";
const distDirName =
  isVercelRuntime && requestedDistDirName === ".next-prod"
    ? ".next"
    : requestedDistDirName;
const clientRoot = path.resolve(__dirname, "..");
const appRoot = path.join(clientRoot, "app");
const buildRoot = path.join(clientRoot, distDirName);

const PROCESS_ENV_PATTERN = /\bprocess\.env\b/;
const FORBIDDEN_ARTIFACT_PATTERNS = [
  /http:\/\/localhost/i,
  /http:\/\/127\.0\.0\.1/i,
  /full-stack-ecommerce-n5at\.onrender\.com/i,
];

const ignoredProcessEnvFiles = new Set([
  path.normalize(path.join(appRoot, "lib", "runtimeEnv.ts")),
  // useBackendReady reads optional NEXT_PUBLIC_ config vars that are not part
  // of the required schema in runtimeEnv.ts. These are purely optional and
  // baked in at build time by Next.js — safe to read directly here.
  path.normalize(path.join(appRoot, "hooks", "network", "useBackendReady.ts")),
]);

const walkFiles = (dir) => {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") {
        return [];
      }
      return walkFiles(absolutePath);
    }
    return [absolutePath];
  });
};

const assertNoInlineProcessEnv = () => {
  const tsFiles = walkFiles(appRoot).filter((filePath) =>
    /\.(ts|tsx)$/.test(filePath)
  );
  const offenders = [];

  for (const filePath of tsFiles) {
    if (ignoredProcessEnvFiles.has(path.normalize(filePath))) {
      continue;
    }
    const content = fs.readFileSync(filePath, "utf8");
    if (PROCESS_ENV_PATTERN.test(content)) {
      offenders.push(path.relative(clientRoot, filePath));
    }
  }

  if (offenders.length > 0) {
    throw new Error(
      `[client-determinism] Inline process.env usage is not allowed outside config layer:\n${offenders
        .map((filePath) => ` - ${filePath}`)
        .join("\n")}`
    );
  }
};

const assertNoForbiddenArtifactValues = () => {
  const artifactFiles = walkFiles(buildRoot).filter((filePath) => {
    if (!/\.(js|mjs|cjs|json|map|html|txt)$/i.test(filePath)) {
      return false;
    }
    const relative = path.relative(buildRoot, filePath).replace(/\\/g, "/");
    const isAppChunk =
      relative.startsWith("server/app/") || relative.startsWith("static/chunks/app/");
    const isVendorChunk =
      relative.includes("vendor-chunks/") ||
      relative.includes("webpack/") ||
      relative.includes("main-app");

    return isAppChunk && !isVendorChunk;
  });
  const offenders = [];

  for (const filePath of artifactFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    if (FORBIDDEN_ARTIFACT_PATTERNS.some((pattern) => pattern.test(content))) {
      offenders.push(path.relative(clientRoot, filePath));
    }
  }

  if (offenders.length > 0) {
    throw new Error(
      `[client-determinism] Build artifact contains forbidden fallback/local values:\n${offenders
        .map((filePath) => ` - ${filePath}`)
        .join("\n")}`
    );
  }
};

if (mode === "pre") {
  assertNoInlineProcessEnv();
  console.log("[client-determinism] Pre-build checks passed.");
  process.exit(0);
}

if (mode === "post") {
  if (!fs.existsSync(buildRoot)) {
    throw new Error(
      `[client-determinism] Build directory not found: ${distDirName}`
    );
  }
  assertNoForbiddenArtifactValues();
  console.log("[client-determinism] Post-build checks passed.");
  process.exit(0);
}

throw new Error(`[client-determinism] Unsupported mode: ${mode}`);
