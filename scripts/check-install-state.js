/* eslint-disable no-console */
const { execFileSync } = require("child_process");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const packageRoots = [
  path.join(repoRoot, "src", "client"),
  path.join(repoRoot, "src", "server"),
];

const reviewedExtraneousPackages = new Map([
  [
    "@emnapi/core",
    "Bundled optional wasm helper surfaced as extraneous by npm on Windows when Tailwind's oxide wasm package is present.",
  ],
  [
    "@emnapi/runtime",
    "Bundled optional wasm helper surfaced as extraneous by npm on Windows when Tailwind's oxide wasm package is present.",
  ],
  [
    "@emnapi/wasi-threads",
    "Bundled optional wasm helper surfaced as extraneous by npm on Windows when Tailwind's oxide wasm package is present.",
  ],
  [
    "@napi-rs/wasm-runtime",
    "Bundled optional wasm helper surfaced as extraneous by npm on Windows when Tailwind's oxide wasm package is present.",
  ],
  [
    "@tybys/wasm-util",
    "Bundled optional wasm helper surfaced as extraneous by npm on Windows when Tailwind's oxide wasm package is present.",
  ],
]);

const seenIssues = [];
const reviewedNotes = [];

const walkDependencies = (node, visit, seen = new Set()) => {
  if (!node || !node.dependencies) {
    return;
  }

  for (const dependency of Object.values(node.dependencies)) {
    if (!dependency || !dependency.path) {
      continue;
    }

    const key = `${dependency.name || "unknown"}@${dependency.version || "unknown"}|${dependency.path}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    visit(dependency);
    walkDependencies(dependency, visit, seen);
  }
};

for (const packageRoot of packageRoots) {
  const packageLabel = path.relative(repoRoot, packageRoot);
  const raw = execFileSync(
    "npm.cmd",
    ["ls", "--json", "--long", "--depth=0", "--omit=dev"],
    {
      cwd: packageRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    }
  );

  const tree = JSON.parse(raw);

  walkDependencies(tree, (dependency) => {
    if (!dependency.extraneous) {
      return;
    }

    const packageName = dependency.name || "unknown";
    const packageVersion = dependency.version || "unknown";
    const reviewedReason = reviewedExtraneousPackages.get(packageName);

    if (reviewedReason) {
      reviewedNotes.push(`${packageLabel} ${packageName}@${packageVersion}: ${reviewedReason}`);
      return;
    }

    seenIssues.push(`${packageLabel} ${packageName}@${packageVersion} is extraneous`);
  });
}

if (seenIssues.length > 0) {
  console.error("[deps] Install-state check failed:\n");
  for (const issue of seenIssues) {
    console.error(` - ${issue}`);
  }
  process.exit(1);
}

console.log("[deps] Install-state check passed.");
if (reviewedNotes.length > 0) {
  console.log("[deps] Reviewed extraneous-package exceptions:");
  for (const note of reviewedNotes) {
    console.log(` - ${note}`);
  }
}
