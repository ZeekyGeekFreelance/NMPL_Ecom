/* eslint-disable no-console */
const { z } = require("zod");
const { loadEnvConfig } = require("@next/env");

const NODE_ENV_OPTIONS = ["development", "test", "production"];
const LOCAL_HOST_PATTERN = /(localhost|127\.0\.0\.1)/i;

const args = new Set(process.argv.slice(2));
const forceProduction = args.has("--production");

if (forceProduction && process.env.NODE_ENV !== "production") {
  process.env.NODE_ENV = "production";
}

loadEnvConfig(process.cwd());

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
  NEXT_PUBLIC_PLATFORM_NAME: z.string().min(1),
  NEXT_PUBLIC_SUPPORT_EMAIL: z.string().email(),
  NEXT_PUBLIC_ENABLE_NATIVE_CONFIRM: z.enum(["true", "false"]).optional(),
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

const env = schema.parse({
  NODE_ENV: forceProduction ? "production" : process.env.NODE_ENV,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_PLATFORM_NAME: process.env.NEXT_PUBLIC_PLATFORM_NAME,
  NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
  NEXT_PUBLIC_ENABLE_NATIVE_CONFIRM: process.env.NEXT_PUBLIC_ENABLE_NATIVE_CONFIRM,
  NEXT_PUBLIC_DEALER_CATALOG_POLL_MS:
    process.env.NEXT_PUBLIC_DEALER_CATALOG_POLL_MS,
});

if (env.NODE_ENV === "production" && LOCAL_HOST_PATTERN.test(env.NEXT_PUBLIC_API_URL)) {
  throw new Error(
    "[client-env] Production build blocked: NEXT_PUBLIC_API_URL cannot target localhost/127.0.0.1"
  );
}

console.log("[client-env] Environment validation passed.");
