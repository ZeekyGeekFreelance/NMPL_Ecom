function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optionalEnv(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

export const config = {
  env: optionalEnv("NODE_ENV", "development") as "development" | "test" | "production",
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV === "development",

  appUrl: optionalEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
  platformName: optionalEnv("PLATFORM_NAME", optionalEnv("NEXT_PUBLIC_PLATFORM_NAME", "NMPL")),
  supportEmail: optionalEnv("SUPPORT_EMAIL", optionalEnv("NEXT_PUBLIC_SUPPORT_EMAIL", "support@nmpl.online")),
  billingEmails: optionalEnv("BILLING_NOTIFICATION_EMAILS", ""),

  auth: {
    accessSecret: optionalEnv("ACCESS_TOKEN_SECRET", "dev_access_secret_replace_in_prod"),
    refreshSecret: optionalEnv("REFRESH_TOKEN_SECRET", "dev_refresh_secret_replace_in_prod"),
    cookieSecret: optionalEnv("COOKIE_SECRET", "dev_cookie_secret_replace"),
    accessTtlSeconds: Number(optionalEnv("ACCESS_TOKEN_TTL_SECONDS", "900")),
    refreshTtlSeconds: Number(optionalEnv("REFRESH_TOKEN_ABS_TTL_SECONDS", "86400")),
    cookieDomain: optionalEnv("COOKIE_DOMAIN", "localhost"),
    cookieSameSite: optionalEnv("COOKIE_SAMESITE", "lax") as "lax" | "strict" | "none",
  },

  smtp: {
    host: optionalEnv("SMTP_HOST", ""),
    port: Number(optionalEnv("SMTP_PORT", "587")),
    secure: optionalEnv("SMTP_SECURE", "false") === "true",
    user: optionalEnv("SMTP_USER", ""),
    pass: optionalEnv("SMTP_PASS", ""),
    from: optionalEnv("EMAIL_FROM", "NMPL <noreply@nmpl.online>"),
  },

  cloudinary: {
    cloudName: optionalEnv("CLOUDINARY_CLOUD_NAME", ""),
    apiKey: optionalEnv("CLOUDINARY_API_KEY", ""),
    apiSecret: optionalEnv("CLOUDINARY_API_SECRET", ""),
  },

  stripe: {
    secretKey: optionalEnv("STRIPE_SECRET_KEY", ""),
    webhookSecret: optionalEnv("STRIPE_WEBHOOK_SECRET", ""),
    publishableKey: optionalEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", ""),
  },

  delivery: {
    bangaloreCharge: Number(optionalEnv("BANGALORE_DELIVERY_CHARGE", "75")),
    pickupStoreName: optionalEnv("PICKUP_STORE_NAME", "NMPL Pickup Desk"),
    pickupStorePhone: optionalEnv("PICKUP_STORE_PHONE", "9999999999"),
  },

  enableMockPayment: optionalEnv("ENABLE_MOCK_PAYMENT", "false") === "true",
};
