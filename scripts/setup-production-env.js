#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));
const secret = () => crypto.randomBytes(64).toString("hex");

const main = async () => {
  console.log("\nNMPL production environment setup");
  console.log("Generates Railway-ready server env and Vercel-ready client env.");
  console.log("Generated files stay local. Do not commit them.\n");

  let domain = (await ask("Apex domain (example: nmpl.in): ")).trim();
  if (!domain) {
    throw new Error("Domain is required.");
  }
  domain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const supportEmail =
    (await ask("Support email [support@nmpl.online]: ")).trim() ||
    "support@nmpl.online";
  const billingEmails =
    (await ask(`Billing notification emails [billing@${domain}]: `)).trim() ||
    `billing@${domain}`;

  console.log("\nDatabase");
  const databaseUrl = (await ask("DATABASE_URL (pooled connection): ")).trim();
  const directUrl = (await ask("DIRECT_URL (optional direct connection, blank to reuse DATABASE_URL): ")).trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  console.log("\nRedis");
  const redisUrl = (await ask("REDIS_URL (rediss://...): ")).trim();
  if (!redisUrl) {
    throw new Error("REDIS_URL is required.");
  }

  console.log("\nEmail");
  const smtpHost =
    (await ask("SMTP host [smtp.sendgrid.net]: ")).trim() || "smtp.sendgrid.net";
  const smtpUser = (await ask("SMTP user: ")).trim();
  const smtpPass = (await ask("SMTP password or API key: ")).trim();
  const emailFrom =
    (await ask(`EMAIL_FROM [noreply@${domain}]: `)).trim() || `noreply@${domain}`;

  console.log("\nPayments");
  const razorpayKeyId = (await ask("RAZORPAY_KEY_ID (blank if unused): ")).trim();
  const razorpayKeySecret = (await ask("RAZORPAY_KEY_SECRET (blank if unused): ")).trim();

  console.log("\nMedia");
  const cloudinaryCloudName = (await ask("CLOUDINARY_CLOUD_NAME (blank if unused): ")).trim();
  const cloudinaryApiKey = (await ask("CLOUDINARY_API_KEY (blank if unused): ")).trim();
  const cloudinaryApiSecret = (await ask("CLOUDINARY_API_SECRET (blank if unused): ")).trim();

  rl.close();

  const accessTokenSecret = secret();
  const refreshTokenSecret = secret();
  const cookieSecret = secret();
  const superAdminResetSecret = secret();
  const apiBase = `https://api.${domain}`;

  const serverEnv = [
    `# Generated ${new Date().toISOString()}`,
    "NODE_ENV=production",
    "DB_ENV=production",
    "DOCKER_MODE=true",
    "TRUST_PROXY=true",
    "PORT=5000",
    `PUBLIC_API_BASE_URL=${apiBase}`,
    "",
    "CLIENT_URL_DEV=http://localhost:3000",
    `CLIENT_URL_PROD=https://${domain}`,
    `ALLOWED_ORIGINS=https://${domain},https://www.${domain}`,
    "",
    `DATABASE_URL=${databaseUrl}`,
    `DIRECT_URL=${directUrl || databaseUrl}`,
    "DB_SSL_REQUIRED=true",
    "DB_POOL_MAX=20",
    "DB_IDLE_TIMEOUT_MS=30000",
    "DB_POOL_TIMEOUT_MS=20000",
    "",
    "REDIS_ENABLED=true",
    `REDIS_URL=${redisUrl}`,
    "REDIS_NAMESPACE=ecommerce_prod",
    "REDIS_PARITY_KEY=config-hash",
    "REDIS_CONNECT_TIMEOUT_MS=5000",
    "",
    `ACCESS_TOKEN_SECRET=${accessTokenSecret}`,
    `REFRESH_TOKEN_SECRET=${refreshTokenSecret}`,
    `COOKIE_SECRET=${cookieSecret}`,
    `SUPERADMIN_RESET_SECRET=${superAdminResetSecret}`,
    "ACCESS_TOKEN_TTL_SECONDS=900",
    "REFRESH_TOKEN_ABS_TTL_SECONDS=604800",
    `COOKIE_DOMAIN=.${domain}`,
    "COOKIE_SAMESITE=strict",
    "",
    "HELMET_ENABLED=true",
    `CSP_DIRECTIVES=default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://res.cloudinary.com; connect-src 'self' ${apiBase}`,
    "BODY_JSON_LIMIT=1mb",
    "BODY_URLENCODED_LIMIT=1mb",
    "MEMORY_UNHEALTHY_THRESHOLD_MB=2048",
    "",
    "RATE_LIMIT_ENABLED=true",
    "RATE_LIMIT_LOGIN_MAX=10",
    "RATE_LIMIT_OTP_MAX=15",
    "RATE_LIMIT_ORDER_MAX=20",
    "",
    "PLATFORM_NAME=NMPL",
    `SUPPORT_EMAIL=${supportEmail}`,
    `BILLING_NOTIFICATION_EMAILS=${billingEmails}`,
    "",
    "BANGALORE_CITY_ALIASES=BANGALORE,BENGALURU",
    "BANGALORE_DELIVERY_CHARGE=75",
    "PICKUP_STORE_NAME=NMPL BLR",
    "PICKUP_STORE_PHONE=+919999999999",
    "PICKUP_STORE_LINE1=3rd Main Road, Chamrajpet",
    "PICKUP_STORE_LANDMARK=Near Makkal-koota Garden",
    "PICKUP_STORE_CITY=Bengaluru",
    "PICKUP_STORE_STATE=Karnataka",
    "PICKUP_STORE_COUNTRY=India",
    "PICKUP_STORE_PINCODE=560004",
    "",
    "REPORTS_CACHE_TTL_SECONDS=300",
    "",
    "SMS_PROVIDER=LOG",
    "REGISTRATION_OTP_EXPIRY_SECONDS=600",
    "REGISTRATION_OTP_RESEND_COOLDOWN_SECONDS=60",
    "REGISTRATION_OTP_MAX_ATTEMPTS=5",
    "REGISTRATION_PHONE_OTP_ENABLED=false",
    "",
    `SMTP_HOST=${smtpHost}`,
    "SMTP_PORT=587",
    "SMTP_SECURE=false",
    `SMTP_USER=${smtpUser}`,
    `SMTP_PASS=${smtpPass}`,
    "EMAIL_SERVICE=smtp",
    `EMAIL_FROM=${emailFrom}`,
    "EMAIL_FROM_NAME=NMPL Support",
    "",
    "ENABLE_MOCK_PAYMENT=false",
    "STRIPE_CURRENCY=inr",
    razorpayKeyId ? `RAZORPAY_KEY_ID=${razorpayKeyId}` : "# RAZORPAY_KEY_ID=",
    razorpayKeySecret
      ? `RAZORPAY_KEY_SECRET=${razorpayKeySecret}`
      : "# RAZORPAY_KEY_SECRET=",
    "RAZORPAY_MOCK_MODE=false",
    "",
    cloudinaryCloudName
      ? `CLOUDINARY_CLOUD_NAME=${cloudinaryCloudName}`
      : "# CLOUDINARY_CLOUD_NAME=",
    cloudinaryApiKey ? `CLOUDINARY_API_KEY=${cloudinaryApiKey}` : "# CLOUDINARY_API_KEY=",
    cloudinaryApiSecret
      ? `CLOUDINARY_API_SECRET=${cloudinaryApiSecret}`
      : "# CLOUDINARY_API_SECRET=",
    "",
    "STRICT_BUILD_CHECKS=true",
    "CLUSTER_PARITY_CHECK_ENABLED=true",
    "MIXED_MODE_GUARD_ENABLED=false",
    "",
  ].join("\n");

  const clientEnv = [
    "NODE_ENV=production",
    `NEXT_PUBLIC_API_URL=${apiBase}/api/v1`,
    `INTERNAL_API_URL=${apiBase}/api/v1`,
    "NEXT_PUBLIC_PLATFORM_NAME=NMPL",
    `NEXT_PUBLIC_SUPPORT_EMAIL=${supportEmail}`,
    "NEXT_PUBLIC_ENABLE_NATIVE_CONFIRM=false",
    "",
  ].join("\n");

  const serverOut = path.join(repoRoot(), "src", "server", ".env.production");
  const clientOut = path.join(repoRoot(), "src", "client", ".env.production");

  fs.writeFileSync(serverOut, serverEnv);
  fs.writeFileSync(clientOut, clientEnv);

  console.log("\nGenerated:");
  console.log(` - ${serverOut}`);
  console.log(` - ${clientOut}`);
  console.log("\nNext steps:");
  console.log(" 1. Copy src/server/.env.production values into Railway.");
  console.log(" 2. Copy src/client/.env.production values into Vercel.");
  console.log(" 3. Run npm run deploy after the CI workflow is green.");
};

const repoRoot = () => path.resolve(__dirname, "..");

main().catch((error) => {
  rl.close();
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
