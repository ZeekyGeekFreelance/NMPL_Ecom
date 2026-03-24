const assert = require("node:assert/strict");
const {
  validateClientEnv,
} = require("../scripts/validate-env.js");

const baseEnv = Object.freeze({
  NODE_ENV: "production",
  NEXT_PUBLIC_API_URL: "https://nmplecom-production.up.railway.app/api/v1",
  NEXT_PUBLIC_PLATFORM_NAME: "NMPL",
  NEXT_PUBLIC_SUPPORT_EMAIL: "support@nmpl.online",
  NEXT_PUBLIC_ENABLE_NATIVE_CONFIRM: "false",
});

module.exports = [
  {
    name: "client production env validation passes without INTERNAL_API_URL",
    run() {
      const env = {
        ...baseEnv,
      };

      const result = validateClientEnv({
        envSource: env,
        forceProduction: true,
      });

      assert.equal(result.env.NEXT_PUBLIC_API_URL, baseEnv.NEXT_PUBLIC_API_URL);
      assert.deepEqual(result.warnings, [
        "[client-env] INTERNAL_API_URL is not set. SSR will fall back to NEXT_PUBLIC_API_URL.",
      ]);
    },
  },
  {
    name: "client production env validation rejects localhost API targets",
    run() {
      assert.throws(
        () =>
          validateClientEnv({
            envSource: {
              ...baseEnv,
              NEXT_PUBLIC_API_URL: "http://localhost:5000/api/v1",
              INTERNAL_API_URL: "http://localhost:5000/api/v1",
            },
            forceProduction: true,
          }),
        /NEXT_PUBLIC_API_URL cannot target localhost/i
      );
    },
  },
  {
    name: "client local preview validation allows localhost API targets with explicit opt-in",
    run() {
      const result = validateClientEnv({
        envSource: {
          ...baseEnv,
          NEXT_PUBLIC_API_URL: "http://localhost:5000/api/v1",
          INTERNAL_API_URL: "http://localhost:5000/api/v1",
        },
        forceProduction: true,
        allowLocalProductionPreview: true,
      });

      assert.equal(result.env.NEXT_PUBLIC_API_URL, "http://localhost:5000/api/v1");
      assert.equal(result.env.INTERNAL_API_URL, "http://localhost:5000/api/v1");
    },
  },
];
