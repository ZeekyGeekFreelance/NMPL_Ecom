/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const packageRoots = [
  repoRoot,
  path.join(repoRoot, "src", "client"),
  path.join(repoRoot, "src", "server"),
];

const allowedLicenses = new Set([
  "0BSD",
  "Apache-2.0",
  "BSD",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "CC-BY-4.0",
  "ISC",
  "MIT",
  "Python-2.0",
  "Unlicense",
]);

const blockedLicensePatterns = [
  /\bAGPL\b/i,
  /\bBUSL\b/i,
  /\bCommons Clause\b/i,
  /\bGPL\b/i,
  /\bLGPL\b/i,
  /\bSSPL\b/i,
];

const licenseExceptionPatterns = [
  {
    pattern: /^@img\/sharp(?:-|$)/,
    reason: "Sharp distributes platform-specific native packages with upstream-reviewed licensing metadata outside the package manifest.",
  },
  {
    pattern: /^@img\/sharp-libvips-/,
    reason: "Libvips platform bundles are pulled in by Sharp and reviewed as part of the Sharp release process.",
  },
  {
    pattern: /^@msgpackr-extract\//,
    reason: "Platform-specific msgpackr-extract binaries are vetted through the parent msgpackr-extract release.",
  },
  {
    pattern: /^@next\/swc-/,
    reason: "Next.js ships platform-specific SWC binaries without SPDX metadata in each package manifest.",
  },
  {
    pattern: /^png-js$/,
    reason: "png-js is a transitive PDFKit dependency without SPDX metadata in its published manifest.",
  },
];

const installScriptAllowlist = new Map([
  ["@apollo/protobufjs", "Apollo's protobuf build helper runs an install script during package setup."],
  ["@prisma/client", "Prisma client generation requires install-time engine setup."],
  ["@prisma/engines", "Prisma engines download native binaries during install."],
  ["msgpackr-extract", "BullMQ transitively uses this optional native acceleration package."],
  ["prisma", "Prisma CLI downloads the query engine required for builds and migrations."],
  ["sharp", "Next.js image optimization depends on Sharp's native install step."],
]);

const dependencyFields = ["dependencies", "optionalDependencies"];
const exactVersionPattern =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const currentPlatform = process.platform;
const currentArch = process.arch;

const loadJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const normalizeLicense = (licenseValue) => {
  if (!licenseValue) {
    return [];
  }

  if (typeof licenseValue === "string") {
    return [licenseValue.trim()].filter(Boolean);
  }

  if (Array.isArray(licenseValue)) {
    return licenseValue.flatMap((value) => normalizeLicense(value));
  }

  if (typeof licenseValue === "object") {
    if (typeof licenseValue.type === "string") {
      return [licenseValue.type.trim()].filter(Boolean);
    }

    if (typeof licenseValue.name === "string") {
      return [licenseValue.name.trim()].filter(Boolean);
    }
  }

  return [];
};

const getPackageNameFromPath = (packagePath) => {
  const segments = packagePath.split(/[\\/]/);
  const lastNodeModulesIndex = segments.lastIndexOf("node_modules");
  const nameStart = lastNodeModulesIndex + 1;
  const first = segments[nameStart];

  if (!first) {
    return packagePath;
  }

  if (first.startsWith("@")) {
    return `${first}/${segments[nameStart + 1]}`;
  }

  return first;
};

const isAllowedLicense = (license) => {
  if (allowedLicenses.has(license)) {
    return true;
  }

  return !blockedLicensePatterns.some((pattern) => pattern.test(license));
};

const getPackageManifest = (packageRoot, packagePath) => {
  const manifestPath = path.join(packageRoot, packagePath, "package.json");
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  return loadJson(manifestPath);
};

const getLicenseException = (packageName) => {
  for (const entry of licenseExceptionPatterns) {
    if (entry.pattern.test(packageName)) {
      return entry.reason;
    }
  }
  return null;
};

const matchesConstraint = (constraint, currentValue) => {
  if (!Array.isArray(constraint) || constraint.length === 0) {
    return true;
  }

  return constraint.includes(currentValue);
};

const isOptionalPackageSkippedForCurrentPlatform = (entry) => {
  if (!entry || entry.optional !== true) {
    return false;
  }

  const supportsCurrentOs = matchesConstraint(entry.os, currentPlatform);
  const supportsCurrentCpu = matchesConstraint(entry.cpu, currentArch);

  return !supportsCurrentOs || !supportsCurrentCpu;
};

const issues = [];
const installScriptNotes = [];
const licenseExceptionNotes = [];

for (const packageRoot of packageRoots) {
  const packageJsonPath = path.join(packageRoot, "package.json");
  const lockfilePath = path.join(packageRoot, "package-lock.json");
  const packageJson = loadJson(packageJsonPath);
  const lockfile = loadJson(lockfilePath);
  const packageLabel = path.relative(repoRoot, packageRoot) || ".";
  const directProdDependencies = new Set();

  for (const field of dependencyFields) {
    const dependencies = packageJson[field] || {};
    for (const [name, version] of Object.entries(dependencies)) {
      directProdDependencies.add(name);
      if (!exactVersionPattern.test(String(version))) {
        issues.push(
          `[exact-version] ${packageLabel} ${field}.${name} must be pinned exactly (found: ${version})`
        );
      }
    }
  }

  const packages = lockfile.packages || {};
  for (const [packagePath, entry] of Object.entries(packages)) {
    if (
      !packagePath ||
      !packagePath.startsWith("node_modules/") ||
      entry.dev === true ||
      isOptionalPackageSkippedForCurrentPlatform(entry)
    ) {
      continue;
    }

    const packageName = entry.name || getPackageNameFromPath(packagePath);
    const packageVersion = entry.version || "unknown";
    const manifest = getPackageManifest(packageRoot, packagePath);
    const installedLicense = normalizeLicense(manifest?.license || manifest?.licenses);
    const deprecatedMessage = String(entry.deprecated || manifest?.deprecated || "").trim();
    const licenseException = getLicenseException(packageName);
    const hasInstallScript =
      entry.hasInstallScript === true ||
      Boolean(manifest?.scripts?.preinstall) ||
      Boolean(manifest?.scripts?.install) ||
      Boolean(manifest?.scripts?.postinstall);

    if (installedLicense.length === 0) {
      if (!licenseException) {
        issues.push(
          `[license-missing] ${packageLabel} ${packageName}@${packageVersion} does not declare a detectable license`
        );
      } else {
        licenseExceptionNotes.push(
          `${packageLabel} ${packageName}@${packageVersion}: ${licenseException}`
        );
      }
    } else {
      const rejectedLicenses = installedLicense.filter((license) => !isAllowedLicense(license));
      if (rejectedLicenses.length > 0 && !licenseException) {
        issues.push(
          `[license-blocked] ${packageLabel} ${packageName}@${packageVersion} uses ${rejectedLicenses.join(", ")}`
        );
      } else if (rejectedLicenses.length > 0 && licenseException) {
        licenseExceptionNotes.push(
          `${packageLabel} ${packageName}@${packageVersion}: ${licenseException}`
        );
      }
    }

    if (deprecatedMessage) {
      issues.push(
        `[deprecated] ${packageLabel} ${packageName}@${packageVersion} is deprecated: ${deprecatedMessage}`
      );
    }

    if (hasInstallScript) {
      const rationale = installScriptAllowlist.get(packageName);
      if (!rationale) {
        issues.push(
          `[install-script] ${packageLabel} ${packageName}@${packageVersion} has an install script and is not allowlisted`
        );
      } else {
        installScriptNotes.push(
          `${packageLabel} ${packageName}@${packageVersion}: ${rationale}`
        );
      }
    }

    if (directProdDependencies.has(packageName) && entry.peer === true) {
      issues.push(
        `[peer-runtime] ${packageLabel} ${packageName}@${packageVersion} resolved as a peer dependency in production; review required`
      );
    }
  }
}

if (issues.length > 0) {
  console.error("[licenses] Production dependency policy failed:\n");
  for (const issue of issues) {
    console.error(` - ${issue}`);
  }
  process.exit(1);
}

console.log("[licenses] Production dependency policy passed.");
if (licenseExceptionNotes.length > 0) {
  console.log("[licenses] Reviewed license exceptions:");
  for (const note of licenseExceptionNotes) {
    console.log(` - ${note}`);
  }
}
if (installScriptNotes.length > 0) {
  console.log("[licenses] Allowlisted install scripts:");
  for (const note of installScriptNotes) {
    console.log(` - ${note}`);
  }
}
