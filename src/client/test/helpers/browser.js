const assert = require("node:assert/strict");

const baseUrl = process.env.BROWSER_BASE_URL || "http://127.0.0.1:3000";

const resolveChannels = () => {
  const requestedChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL;
  const defaultChannel =
    process.platform === "win32"
      ? "msedge"
      : process.platform === "darwin"
        ? "chrome"
        : "chrome";

  return Array.from(
    new Set([requestedChannel, defaultChannel, undefined].filter((value) => value !== null))
  );
};

const launchBrowser = async () => {
  const { chromium } = require("playwright");
  const launchErrors = [];

  for (const channel of resolveChannels()) {
    try {
      return await chromium.launch({
        headless: true,
        ...(channel ? { channel } : {}),
      });
    } catch (error) {
      launchErrors.push(
        `${channel || "bundled-chromium"}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  throw new Error(
    `Unable to launch a Playwright browser. Tried channels: ${launchErrors.join(" | ")}`
  );
};

const withBrowserPage = async (run) => {
  const browser = await launchBrowser();
  const context = await browser.newContext({
    baseURL: baseUrl,
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    await run({ browser, context, page });
  } finally {
    await context.close();
    await browser.close();
  }
};

const waitForCatalogReady = async (page) => {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(
    () => !document.body.innerText.includes("Loading catalog..."),
    null,
    { timeout: 20000 }
  );
};

const expectVisibleText = async (page, text) => {
  const locator = page.getByText(text, { exact: false }).first();
  await locator.waitFor({ state: "visible", timeout: 20000 });
  assert.equal(await locator.isVisible(), true, `"${text}" should be visible`);
};

module.exports = {
  baseUrl,
  expectVisibleText,
  waitForCatalogReady,
  withBrowserPage,
};
