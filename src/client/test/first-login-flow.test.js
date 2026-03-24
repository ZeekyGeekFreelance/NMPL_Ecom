const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const clientRoot = path.resolve(__dirname, "..");

const readSource = (relativePath) =>
  fs.readFileSync(path.join(clientRoot, relativePath), "utf8");

const signInPageSource = readSource(path.join("app", "(auth)", "sign-in", "page.tsx"));
const dealerSignInPageSource = readSource(
  path.join("app", "(auth)", "dealer", "sign-in", "page.tsx")
);
const changePasswordPageSource = readSource(
  path.join("app", "(auth)", "change-password", "page.tsx")
);
const firstLoginFlowSource = readSource(path.join("app", "lib", "firstLoginPasswordFlow.ts"));

module.exports = [
  {
    name: "regular sign-in redirects forced first-login accounts to the generic change-password page",
    run() {
      assert.match(signInPageSource, /response\.requiresPasswordChange/);
      assert.match(signInPageSource, /storeFirstLoginState\(/);
      assert.match(signInPageSource, /router\.push\("\/change-password"\)/);
    },
  },
  {
    name: "dealer sign-in preserves the first-login flow through shared storage",
    run() {
      assert.match(dealerSignInPageSource, /response\.requiresPasswordChange/);
      assert.match(dealerSignInPageSource, /storeFirstLoginState\(/);
      assert.match(dealerSignInPageSource, /router\.push\("\/dealer\/change-password"\)/);
    },
  },
  {
    name: "generic change-password page completes first-login auth and redirects by role",
    run() {
      assert.match(changePasswordPageSource, /useChangePasswordOnFirstLoginMutation/);
      assert.match(changePasswordPageSource, /resolvePostPasswordChangeDestination/);
      assert.match(changePasswordPageSource, /window\.location\.href/);
    },
  },
  {
    name: "shared first-login storage keeps backward compatibility with legacy dealer temp keys",
    run() {
      assert.match(firstLoginFlowSource, /auth\.firstLogin/);
      assert.match(firstLoginFlowSource, /dealer_temp_email/);
      assert.match(firstLoginFlowSource, /dealer_temp_password/);
    },
  },
];
