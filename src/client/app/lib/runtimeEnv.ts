import { z } from "zod";

const NODE_ENV_OPTIONS = ["development", "test", "production"] as const;
const LOCAL_HOST_PATTERN = /(localhost|127\.0\.0\.1)/i;

const trim = (value: string): string => value.trim();

const normalizeApiBaseUrl = (value: string): string => {
  const trimmed = trim(value).replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error("[client-config] NEXT_PUBLIC_API_URL is empty after normalization");
  }

  if (/\/api\/v1$/i.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed}/api/v1`;
};

const resolveDevApiBaseUrl = (configuredApiBaseUrl: string, nodeEnv: string): string => {
  if (nodeEnv !== "development" || typeof window === "undefined") {
    return configuredApiBaseUrl;
  }

  try {
    const resolvedUrl = new URL(configuredApiBaseUrl);
    const browserHost = window.location.hostname.trim();

    if (!browserHost || resolvedUrl.hostname === browserHost) {
      return configuredApiBaseUrl;
    }

    // Keep protocol/port/path, but align host with the browser origin
    // so auth cookies remain first-party for both localhost and LAN usage.
    resolvedUrl.hostname = browserHost;
    return normalizeApiBaseUrl(resolvedUrl.toString());
  } catch {
    return configuredApiBaseUrl;
  }
};

const envSchema = z.object({
  NODE_ENV: z.enum(NODE_ENV_OPTIONS, {
    required_error: "[client-config] Missing required environment variable: NODE_ENV",
  }),
  NEXT_PUBLIC_API_URL: z
    .string({
      required_error:
        "[client-config] Missing required environment variable: NEXT_PUBLIC_API_URL",
    })
    .min(1, "[client-config] NEXT_PUBLIC_API_URL cannot be empty")
    .transform(normalizeApiBaseUrl),
  NEXT_PUBLIC_PLATFORM_NAME: z
    .string({
      required_error:
        "[client-config] Missing required environment variable: NEXT_PUBLIC_PLATFORM_NAME",
    })
    .min(1, "[client-config] NEXT_PUBLIC_PLATFORM_NAME cannot be empty")
    .transform(trim),
  NEXT_PUBLIC_SUPPORT_EMAIL: z
    .string({
      required_error:
        "[client-config] Missing required environment variable: NEXT_PUBLIC_SUPPORT_EMAIL",
    })
    .email("[client-config] NEXT_PUBLIC_SUPPORT_EMAIL must be a valid email")
    .transform(trim),
  NEXT_PUBLIC_ENABLE_NATIVE_CONFIRM: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
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
          "[client-config] NEXT_PUBLIC_DEALER_CATALOG_POLL_MS must be a positive integer"
        );
      }
      return parsed;
    }),
  INTERNAL_API_URL: z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined || value.trim() === "") {
        return undefined;
      }
      return normalizeApiBaseUrl(value);
    }),
});

const parsed = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_PLATFORM_NAME: process.env.NEXT_PUBLIC_PLATFORM_NAME,
  NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
  NEXT_PUBLIC_ENABLE_NATIVE_CONFIRM: process.env.NEXT_PUBLIC_ENABLE_NATIVE_CONFIRM,
  NEXT_PUBLIC_DEALER_CATALOG_POLL_MS:
    process.env.NEXT_PUBLIC_DEALER_CATALOG_POLL_MS,
  INTERNAL_API_URL: process.env.INTERNAL_API_URL,
});

if (parsed.NODE_ENV === "production" && LOCAL_HOST_PATTERN.test(parsed.NEXT_PUBLIC_API_URL)) {
  throw new Error(
    "[client-config] Production build blocked: NEXT_PUBLIC_API_URL cannot target localhost/127.0.0.1"
  );
}

const resolvedApiBaseUrl = resolveDevApiBaseUrl(
  parsed.NEXT_PUBLIC_API_URL,
  parsed.NODE_ENV
);

export const runtimeEnv = Object.freeze({
  nodeEnv: parsed.NODE_ENV,
  isProduction: parsed.NODE_ENV === "production",
  isDevelopment: parsed.NODE_ENV === "development",
  isTest: parsed.NODE_ENV === "test",
  apiBaseUrl: resolvedApiBaseUrl,
  internalApiUrl: parsed.INTERNAL_API_URL,
  platformName: parsed.NEXT_PUBLIC_PLATFORM_NAME,
  supportEmail: parsed.NEXT_PUBLIC_SUPPORT_EMAIL,
  enableNativeConfirm: parsed.NEXT_PUBLIC_ENABLE_NATIVE_CONFIRM,
  dealerCatalogPollMs: parsed.NEXT_PUBLIC_DEALER_CATALOG_POLL_MS,
});
