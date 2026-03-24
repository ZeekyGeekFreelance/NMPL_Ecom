const assert = require("node:assert/strict");
const {
  baseUrl,
  expectVisibleText,
  waitForCatalogReady,
  withBrowserPage,
} = require("./helpers/browser");

const adminEmail = process.env.BROWSER_ADMIN_EMAIL || "admin@example.com";
const adminPassword = process.env.BROWSER_ADMIN_PASSWORD || "password123";

module.exports = [
  {
    name: "storefront home, shop, and product detail render real catalog data",
    live: true,
    tags: ["browser"],
    async run() {
      await withBrowserPage(async ({ page }) => {
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await expectVisibleText(page, "Leather Wallet");

        await page.goto("/shop", { waitUntil: "domcontentloaded" });
        await waitForCatalogReady(page);
        await expectVisibleText(page, "Leather Wallet");

        await page.goto("/product/leather-wallet", {
          waitUntil: "domcontentloaded",
        });
        await expectVisibleText(page, "Leather Wallet");
        await expectVisibleText(page, "SKU: WLT-LTH-BLK-1");
      });
    },
  },
  {
    name: "admin sign-in reaches the dashboard without redirect churn",
    live: true,
    tags: ["browser"],
    async run() {
      await withBrowserPage(async ({ page }) => {
        await page.goto("/sign-in", { waitUntil: "domcontentloaded" });

        await page.getByPlaceholder("Email").fill(adminEmail);
        await page.getByPlaceholder("Password").fill(adminPassword);
        await page.getByRole("button", { name: "Sign In" }).click();

        await page.waitForURL("**/dashboard", { timeout: 20000 });
        await expectVisibleText(page, "Dashboard Overview");
        await page.getByRole("button", { name: /open message log center/i }).waitFor({
          state: "visible",
          timeout: 20000,
        });

        assert.match(page.url(), /\/dashboard$/);
        assert.equal(
          page.url().startsWith(baseUrl),
          true,
          "Admin dashboard should stay on the local client host"
        );
      });
    },
  },
];
