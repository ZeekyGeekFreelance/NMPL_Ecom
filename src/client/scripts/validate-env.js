/* eslint-disable no-console */
const { z } = require("zod");
const { loadEnvConfig } = require("@next/env");

const NODE_ENV_OPTIONS = ["development", "test", "production"];
const LOCAL_HOST_PATTERN = /(localhost|127\.0\.0\.1)/i;

const normalizeApiBaseUrl = (value) => {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error("[client-env] NEXT_PUBLIC_API_URL cannot be empty");
  }
  return /\/api\/v1$/i.test(trimmed) ? trimmed : `${trimmed}/api/v1`;
};

const schema = z.object({
  NODE_ENV: z.enum(NODE_ENV_OPTIONS),
  NEXT_PUBLIC_API_URL: z.string().min(1).transform(normalizeApiBaseUrl),
  INTERNAL_API_URL: z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined || value.trim() === "") {
        return undefined;
      }
      return normalizeApiBaseUrl(value);
    }),
  NEXT_PUBLIC_PLATFORM_NAME: z.string().min(1),
  NEXT_PUBLIC_SUPPORT_EMAIL: z.string().email(),
  NEXT_PUBLIC_ENABLE_NATIVE_CONFIRM: z.enum(["true", "false"]).optional(),
  NEXT_PUBLIC_ALLOW_LOCAL_PRODUCTION_PREVIEW: z
    .enum(["true", "false"])
    .optional(),
  NEXT_PUBLIC_DEALER_CATALOG_POLL_MS: z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined || value.trim() === "") {
        return undefined;
      }
      const parsed = Number(value.trim());
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(
          "[client-env] NEXT_PUBLIC_DEALER_CATALOG_POLL_MS must be a positive integer"
        );
      }
      return parsed;
    }),
});

const validateClientEnv = ({
  envSource = process.env,
  forceProduction = false,
  allowLocalProductionPreview = false,
} = {}) => {
  const env = schema.parse({
    NODE_ENV: forceProduction ? "production" : envSource.NODE_ENV,
    NEXT_PUBLIC_API_URL: envSource.NEXT_PUBLIC_API_URL,
    INTERNAL_API_URL: envSource.INTERNAL_API_URL,
    NEXT_PUBLIC_PLATFORM_NAME: envSource.NEXT_PUBLIC_PLATFORM_NAME,
    NEXT_PUBLIC_SUPPORT_EMAIL: envSource.NEXT_PUBLIC_SUPPORT_EMAIL,
    NEXT_PUBLIC_ENABLE_NATIVE_CONFIRM: envSource.NEXT_PUBLIC_ENABLE_NATIVE_CONFIRM,
    NEXT_PUBLIC_ALLOW_LOCAL_PRODUCTION_PREVIEW:
      envSource.NEXT_PUBLIC_ALLOW_LOCAL_PRODUCTION_PREVIEW,
    NEXT_PUBLIC_DEALER_CATALOG_POLL_MS:
      envSource.NEXT_PUBLIC_DEALER_CATALOG_POLL_MS,
  });

  if (
    env.NODE_ENV === "production" &&
    !allowLocalProductionPreview &&
    LOCAL_HOST_PATTERN.test(env.NEXT_PUBLIC_API_URL)
  ) {
    throw new Error(
      "[client-env] Production build blocked: NEXT_PUBLIC_API_URL cannot target localhost/127.0.0.1"
    );
  }

  return {
    env,
    warnings:
      env.NODE_ENV === "production" && !env.INTERNAL_API_URL
        ? [
          "[client-env] INTERNAL_API_URL is not set. SSR will fall back to NEXT_PUBLIC_API_URL.",
        ]
        : [],
  };
};

if (require.main === module) {
  const args = new Set(process.argv.slice(2));
  const forceProduction = args.has("--production");
  const allowLocalProductionPreview =
    args.has("--local-preview") ||
    String(process.env.ALLOW_LOCAL_PRODUCTION_PREVIEW || "").trim().toLowerCase() ===
      "true";

  if (forceProduction && process.env.NODE_ENV !== "production") {
    process.env.NODE_ENV = "production";
  }

  loadEnvConfig(process.cwd());
  const result = validateClientEnv({
    envSource: process.env,
    forceProduction,
    allowLocalProductionPreview,
  });

  for (const warning of result.warnings) {
    console.warn(warning);
  }

  console.log("[client-env] Environment validation passed.");
}

module.exports = {
  normalizeApiBaseUrl,
  validateClientEnv,
};
