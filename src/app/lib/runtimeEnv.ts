/**
 * Runtime environment configuration for the full-stack Next.js v99 app.
 * Since API routes are internal (/api/*), no external API URL is needed.
 */

const nodeEnv = (process.env.NODE_ENV ?? "development") as "development" | "test" | "production";

export const runtimeEnv = Object.freeze({
  nodeEnv,
  isProduction: nodeEnv === "production",
  isDevelopment: nodeEnv === "development",
  isTest: nodeEnv === "test",
  // In v99, all API calls go to internal /api routes — no external base URL needed
  apiBaseUrl: "/api",
  internalApiUrl: undefined as string | undefined,
  platformName: process.env.NEXT_PUBLIC_PLATFORM_NAME ?? "NMPL",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@nmpl.com",
  enableNativeConfirm: process.env.NEXT_PUBLIC_ENABLE_NATIVE_CONFIRM === "true" ? true : undefined,
  allowLocalProductionPreview: process.env.NEXT_PUBLIC_ALLOW_LOCAL_PRODUCTION_PREVIEW === "true" ? true : undefined,
  dealerCatalogPollMs: process.env.NEXT_PUBLIC_DEALER_CATALOG_POLL_MS
    ? Number(process.env.NEXT_PUBLIC_DEALER_CATALOG_POLL_MS)
    : undefined,
});
