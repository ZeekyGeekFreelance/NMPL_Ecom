/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const packageDirs = [root, path.join(root, "src", "server"), path.join(root, "src", "client")];
const dependencyFields = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];
const EXACT_VERSION_PATTERN =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const exists = (filePath) => fs.existsSync(filePath);

const findFiles = (dir, names, found = []) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") {
        continue;
      }
      findFiles(fullPath, names, found);
      continue;
    }
    if (names.includes(entry.name)) {
      found.push(fullPath);
    }
  }
  return found;
};

if (!exists(path.join(root, ".nvmrc"))) {
  throw new Error("[repo-sanity] Missing .nvmrc");
}

for (const dir of packageDirs) {
  const hasPackageJson = exists(path.join(dir, "package.json"));
  if (!hasPackageJson) {
    continue;
  }

  const lockfiles = ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"].filter((fileName) =>
    exists(path.join(dir, fileName))
  );

  if (lockfiles.length !== 1 || lockfiles[0] !== "package-lock.json") {
    throw new Error(
      `[repo-sanity] ${path.relative(root, dir)} must use only package-lock.json (found: ${lockfiles.join(", ") || "none"})`
    );
  }

  const packageJson = JSON.parse(
    fs.readFileSync(path.join(dir, "package.json"), "utf8")
  );

  for (const field of dependencyFields) {
    const dependencies = packageJson[field] || {};
    for (const [name, version] of Object.entries(dependencies)) {
      if (!EXACT_VERSION_PATTERN.test(String(version))) {
        throw new Error(
          `[repo-sanity] ${path.relative(root, dir) || "."} ${field}.${name} must use an exact version (found: ${version})`
        );
      }
    }
  }
}

const foreignLockfiles = findFiles(root, ["yarn.lock", "pnpm-lock.yaml"]).filter(
  (filePath) => !filePath.includes(`${path.sep}node_modules${path.sep}`)
);

if (foreignLockfiles.length > 0) {
  throw new Error(
    `[repo-sanity] Unexpected lockfiles detected:\n${foreignLockfiles
      .map((filePath) => ` - ${path.relative(root, filePath)}`)
      .join("\n")}`
  );
}

console.log("[repo-sanity] Repository sanity checks passed.");
