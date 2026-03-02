/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const mode = process.argv[2] || "pre";
const serverRoot = path.resolve(__dirname, "..");
const sourceRoot = path.join(serverRoot, "src");
const distRoot = path.join(serverRoot, "dist");

const PROCESS_ENV_PATTERN = /\bprocess\.env\b/;
const FORBIDDEN_ARTIFACT_PATTERNS = [
  /http:\/\/localhost/i,
  /http:\/\/127\.0\.0\.1/i,
  /full-stack-ecommerce-n5at\.onrender\.com/i,
];

const ignoredProcessEnvFiles = new Set([
  path.normalize(path.join(sourceRoot, "config", "index.ts")),
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
  const tsFiles = walkFiles(sourceRoot).filter((filePath) =>
    filePath.endsWith(".ts")
  );
  const offenders = [];

  for (const filePath of tsFiles) {
    if (ignoredProcessEnvFiles.has(path.normalize(filePath))) {
      continue;
    }
    const content = fs.readFileSync(filePath, "utf8");
    if (PROCESS_ENV_PATTERN.test(content)) {
      offenders.push(path.relative(serverRoot, filePath));
    }
  }

  if (offenders.length > 0) {
    throw new Error(
      `[determinism] Inline process.env usage is not allowed outside config layer:\n${offenders
        .map((filePath) => ` - ${filePath}`)
        .join("\n")}`
    );
  }
};

const assertNoForbiddenArtifactValues = () => {
  const artifactFiles = walkFiles(distRoot).filter((filePath) => {
    if (!/\.(js|mjs|cjs|json|map)$/i.test(filePath)) {
      return false;
    }
    const relative = path.relative(distRoot, filePath).replace(/\\/g, "/");
    if (relative === "config/index.js") {
      return false;
    }
    return true;
  });
  const offenders = [];

  for (const filePath of artifactFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    if (FORBIDDEN_ARTIFACT_PATTERNS.some((pattern) => pattern.test(content))) {
      offenders.push(path.relative(serverRoot, filePath));
    }
  }

  if (offenders.length > 0) {
    throw new Error(
      `[determinism] Build artifact contains forbidden fallback/local values:\n${offenders
        .map((filePath) => ` - ${filePath}`)
        .join("\n")}`
    );
  }
};

if (mode === "pre") {
  assertNoInlineProcessEnv();
  console.log("[determinism] Pre-build checks passed.");
  process.exit(0);
}

if (mode === "post") {
  assertNoForbiddenArtifactValues();
  console.log("[determinism] Post-build checks passed.");
  process.exit(0);
}

throw new Error(`[determinism] Unsupported mode: ${mode}`);
