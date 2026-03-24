const assert = require("node:assert/strict");
const { HttpSession } = require("./helpers/httpSession");

const baseUrl = process.env.SMOKE_API_BASE_URL || "http://127.0.0.1:5000";
const adminEmail = process.env.SMOKE_ADMIN_EMAIL || "admin@example.com";
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD || "password123";

const createSession = () => new HttpSession(baseUrl);

const signInAsAdmin = async () => {
  const session = createSession();
  await session.bootstrapCsrf();

  const { response, payload } = await session.requestJson("/api/v1/auth/sign-in", {
    method: "POST",
    json: {
      email: adminEmail,
      password: adminPassword,
      portal: "USER_PORTAL",
    },
  });

  assert.equal(response.status, 200, "Admin sign-in must succeed");
  assert.ok(session.cookies.has("accessToken"), "Admin sign-in must set accessToken");
  assert.ok(
    session.cookies.has("refreshToken"),
    "Admin sign-in must set refreshToken"
  );
  assert.match(
    payload?.user?.effectiveRole || payload?.user?.role || "",
    /ADMIN|SUPERADMIN/,
    "Admin sign-in must return an admin-capable user"
  );

  return session;
};

module.exports = [
  {
    name: "booted health endpoint reports a ready runtime",
    live: true,
    tags: ["smoke-api"],
    async run() {
      const response = await fetch(`${baseUrl}/health`);
      const payload = await response.json();

      assert.equal(response.status, 200);
      assert.equal(payload?.healthy, true);
      assert.equal(payload?.checks?.serverReady, true);
      assert.equal(payload?.checks?.database, true);
    },
  },
  {
    name: "csrf bootstrap exposes token and cookies for browser sessions",
    live: true,
    tags: ["smoke-api"],
    async run() {
      const session = createSession();
      await session.bootstrapCsrf();

      assert.ok(session.cookies.has("sessionId"));
    },
  },
  {
    name: "public graphql catalog query returns products without authentication",
    live: true,
    tags: ["smoke-api"],
    async run() {
      const session = createSession();
      const { response, payload } = await session.requestJson("/api/v1/graphql", {
        method: "POST",
        json: {
          operationName: "SmokeProducts",
          variables: { first: 4 },
          query: `
            query SmokeProducts($first: Int) {
              products(first: $first) {
                products {
                  id
                  slug
                  name
                  minPrice
                  maxPrice
                }
                totalCount
                hasMore
              }
            }
          `,
        },
      });

      assert.equal(response.status, 200);
      assert.equal(Array.isArray(payload?.errors), false, "GraphQL smoke query must not error");
      assert.ok(payload?.data?.products?.totalCount > 0, "Catalog must not be empty");
      assert.ok(
        payload?.data?.products?.products?.some((product) => product.slug === "leather-wallet"),
        "Smoke catalog query must include a stable seeded product"
      );
    },
  },
  {
    name: "protected profile endpoint rejects anonymous callers",
    live: true,
    tags: ["smoke-api"],
    async run() {
      const session = createSession();
      const { response, payload } = await session.requestJson("/api/v1/users/me");

      assert.equal(response.status, 401);
      assert.match(String(payload?.message || ""), /unauthorized|log in/i);
    },
  },
  {
    name: "admin session can reach protected summary endpoints and sign out cleanly",
    live: true,
    tags: ["smoke-api"],
    async run() {
      const session = await signInAsAdmin();

      const meResult = await session.requestJson("/api/v1/users/me");
      assert.equal(meResult.response.status, 200);
      assert.match(
        meResult.payload?.user?.effectiveRole ||
          meResult.payload?.effectiveRole ||
          meResult.payload?.user?.role ||
          "",
        /ADMIN|SUPERADMIN/
      );

      const transactionSummaryResult = await session.requestJson(
        "/api/v1/transactions/summary"
      );
      assert.equal(transactionSummaryResult.response.status, 200);
      assert.equal(
        typeof transactionSummaryResult.payload?.summary?.pendingVerificationCount,
        "number"
      );

      const dealerSummaryResult = await session.requestJson(
        "/api/v1/users/dealers/summary"
      );
      assert.equal(dealerSummaryResult.response.status, 200);
      assert.equal(
        typeof dealerSummaryResult.payload?.summary?.pendingCount,
        "number"
      );

      const signOutResult = await session.requestJson("/api/v1/auth/sign-out", {
        method: "POST",
      });
      assert.equal(signOutResult.response.status, 200);

      const postSignOutProfile = await session.requestJson("/api/v1/users/me");
      assert.equal(postSignOutProfile.response.status, 401);
    },
  },
];
