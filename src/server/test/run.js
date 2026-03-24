const fs = require("node:fs");
const path = require("node:path");

const testDir = __dirname;
const cliArgs = process.argv.slice(2);
const includeLive = cliArgs.includes("--include-live");
const requestedTags = new Set(
  cliArgs
    .filter((arg) => arg.startsWith("--tag="))
    .flatMap((arg) => arg.slice("--tag=".length).split(","))
    .map((tag) => tag.trim())
    .filter(Boolean)
);

const collectTestFiles = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const resolved = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(resolved));
      continue;
    }
    if (
      entry.isFile() &&
      entry.name.endsWith(".test.js") &&
      entry.name !== "run.js"
    ) {
      files.push(resolved);
    }
  }

  return files.sort();
};

const execute = async () => {
  const files = collectTestFiles(testDir);
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const file of files) {
    const testCases = require(file);
    if (!Array.isArray(testCases)) {
      throw new Error(`[test] ${file} must export an array of test cases.`);
    }

    for (const testCase of testCases) {
      if (!testCase || typeof testCase.name !== "string" || typeof testCase.run !== "function") {
        throw new Error(`[test] ${file} exported an invalid test case.`);
      }

      const label = `${path.relative(testDir, file)} :: ${testCase.name}`;
      const testTags = Array.isArray(testCase.tags)
        ? testCase.tags.filter((tag) => typeof tag === "string" && tag.trim().length > 0)
        : [];

      if (
        requestedTags.size > 0 &&
        !testTags.some((tag) => requestedTags.has(tag))
      ) {
        continue;
      }

      if (testCase.live === true && !includeLive) {
        skipped += 1;
        console.log(`[skip] ${label} (live test not enabled)`);
        continue;
      }

      try {
        await testCase.run();
        passed += 1;
        console.log(`[pass] ${label}`);
      } catch (error) {
        failed += 1;
        console.error(`[fail] ${label}`);
        console.error(error instanceof Error ? error.stack || error.message : String(error));
      }
    }
  }

  console.log(
    `[test] server suite complete: ${passed} passed, ${failed} failed, ${skipped} skipped`
  );
  if (failed > 0) {
    process.exit(1);
  }
};

execute().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
