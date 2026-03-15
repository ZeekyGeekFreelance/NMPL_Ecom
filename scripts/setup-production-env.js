#!/usr/bin/env node

/**
 * Production Environment Setup Wizard
 *
 * Generates src/server/.env.production and src/client/.env.production
 * with real secrets and correct domain values.
 *
 * Usage: node scripts/setup-production-env.js
 */

const crypto = require("crypto");
const readline = require("readline");
const fs = require("fs");
const path = require("path");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));
const secret = () => crypto.randomBytes(64).toString("hex");

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  NMPL Ecommerce — Production Environment Setup Wizard        ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
  console.log("⚠️  Generated files are gitignored. Never commit them.\n");

  // ── Domain ────────────────────────────────────────────────────────────────
  let domain = (await ask("Your apex domain (e.g. nmpl.in): ")).trim();
  if (!domain) {
    console.error("❌ Domain is required"); process.exit(1);
  }
  domain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");

  // ── Database ──────────────────────────────────────────────────────────────
  console.log("\n── Database (Neon) ──────────────────────────────────────────────");
  const dbUrl    = (await ask("Pooled connection URL (DATABASE_URL): ")).trim();
  const directUrl = (await ask("Direct connection URL (DIRECT_URL):   ")).trim();
  if (!dbUrl || !directUrl) {
    console.error("❌ Both DB URLs are required"); process.exit(1);
  }

  // ── Redis ─────────────────────────────────────────────────────────────────
  console.log("\n── Redis (Upstash) ──────────────────────────────────────────────");
  console.log("  Create a free instance at https://upstash.com → Redis → Create");
  const redisUrl = (await ask("Redis URL (rediss://...):              ")).trim();
  if (!redisUrl) {
    console.error("❌ Redis URL is required for production"); process.exit(1);
  }

  // ── Email ─────────────────────────────────────────────────────────────────
  console.log("\n── Email (SMTP) ─────────────────────────────────────────────────");
  const smtpHost = (await ask("SMTP host (e.g. smtp.sendgrid.net):    ")).trim() || "smtp.sendgrid.net";
  const smtpUser = (await ask("SMTP user (e.g. apikey):               ")).trim();
  const smtpPass = (await ask("SMTP password / API key:               ")).trim();
  const emailFrom = (await ask(`FROM address (e.g. noreply@${domain}): `)).trim() || `noreply@${domain}`;

  // ── Payment ───────────────────────────────────────────────────────────────
  console.log("\n── Razorpay (live) ──────────────────────────────────────────────");
  const rzpKeyId     = (await ask("Razorpay Key ID (rzp_live_...):       ")).trim();
  const rzpKeySecret = (await ask("Razorpay Key Secret:                  ")).trim();

  // ── Cloudinary ────────────────────────────────────────────────────────────
  console.log("\n── Cloudinary ───────────────────────────────────────────────────");
  const cloudName   = (await ask("Cloud name:                           ")).trim();
  const cloudKey    = (await ask("API Key:                              ")).trim();
  const cloudSecret = (await ask("API Secret:                           ")).trim();

  rl.close();

  // ── Generate secrets ──────────────────────────────────────────────────────
  console.log("\n✅ Generating 4 cryptographic secrets...");
  const ACCESS_TOKEN_SECRET  = secret();
  const REFRESH_TOKEN_SECRET = secret();
  const SESSION_SECRET       = secret();
  const COOKIE_SECRET        = secret();

  // ── Write server .env.production ─────────────────────────────────────────
  const serverEnv = `# ══ PRODUCTION — generated ${new Date().toISOString()} ══
# ⚠️  Never commit this file.

NODE_ENV=production
DB_ENV=production
DOCKER_MODE=true
TRUST_PROXY=true
PORT=5000
PUBLIC_API_BASE_URL=https://api.${domain}

CLIENT_URL_DEV=http://localhost:3000
CLIENT_URL_PROD=https://${domain}
ALLOWED_ORIGINS=https://${domain},https://www.${domain}

DATABASE_URL=${dbUrl}
DIRECT_URL=${directUrl}
DB_SSL_REQUIRED=true
DB_POOL_MAX=20
DB_IDLE_TIMEOUT_MS=30000
DB_POOL_TIMEOUT_MS=20000

REDIS_ENABLED=true
REDIS_URL=${redisUrl}
REDIS_NAMESPACE=ecommerce_prod
REDIS_PARITY_KEY=config-hash
REDIS_CONNECT_TIMEOUT_MS=5000

ACCESS_TOKEN_SECRET=${ACCESS_TOKEN_SECRET}
REFRESH_TOKEN_SECRET=${REFRESH_TOKEN_SECRET}
SESSION_SECRET=${SESSION_SECRET}
COOKIE_SECRET=${COOKIE_SECRET}
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_ABS_TTL_SECONDS=604800
COOKIE_DOMAIN=.${domain}
COOKIE_SAMESITE=strict

HELMET_ENABLED=true
CSP_DIRECTIVES=default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://res.cloudinary.com; connect-src 'self' https://api.${domain}
BODY_JSON_LIMIT=1mb
BODY_URLENCODED_LIMIT=1mb
MEMORY_UNHEALTHY_THRESHOLD_MB=2048

RATE_LIMIT_ENABLED=true
RATE_LIMIT_LOGIN_MAX=10
RATE_LIMIT_OTP_MAX=15
RATE_LIMIT_ORDER_MAX=20

PLATFORM_NAME=NMPL
SUPPORT_EMAIL=support@${domain}
BILLING_NOTIFICATION_EMAILS=billing@${domain}

BANGALORE_CITY_ALIASES=BANGALORE,BENGALURU
BANGALORE_DELIVERY_CHARGE=75
PICKUP_STORE_NAME=NMPL BLR
PICKUP_STORE_PHONE=+919999999999
PICKUP_STORE_LINE1=3rd Main Road, Chamrajpet
PICKUP_STORE_LANDMARK=Near Makkal-koota Garden
PICKUP_STORE_CITY=Bengaluru
PICKUP_STORE_STATE=Karnataka
PICKUP_STORE_COUNTRY=India
PICKUP_STORE_PINCODE=560004

ORDER_RESERVATION_EXPIRY_HOURS=48
ORDER_RESERVATION_SWEEP_SECONDS=60
REPORTS_CACHE_TTL_SECONDS=300

SMS_PROVIDER=LOG
REGISTRATION_OTP_EXPIRY_SECONDS=600
REGISTRATION_OTP_RESEND_COOLDOWN_SECONDS=60
REGISTRATION_OTP_MAX_ATTEMPTS=5
REGISTRATION_PHONE_OTP_ENABLED=false

SMTP_HOST=${smtpHost}
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=${smtpUser}
SMTP_PASS=${smtpPass}
EMAIL_SERVICE=smtp
EMAIL_FROM=${emailFrom}
EMAIL_FROM_NAME=NMPL Support

ENABLE_MOCK_PAYMENT=false
STRIPE_CURRENCY=inr
${rzpKeyId ? `RAZORPAY_KEY_ID=${rzpKeyId}` : "# RAZORPAY_KEY_ID=rzp_live_XXXXXXXX"}
${rzpKeySecret ? `RAZORPAY_KEY_SECRET=${rzpKeySecret}` : "# RAZORPAY_KEY_SECRET=XXXXXXXX"}
RAZORPAY_MOCK_MODE=false

GOOGLE_CALLBACK_URL_PROD=https://api.${domain}/api/v1/auth/google/callback
FACEBOOK_CALLBACK_URL_PROD=https://api.${domain}/api/v1/auth/facebook/callback
TWITTER_CALLBACK_URL_PROD=https://api.${domain}/api/v1/auth/twitter/callback

${cloudName ? `CLOUDINARY_CLOUD_NAME=${cloudName}` : "# CLOUDINARY_CLOUD_NAME="}
${cloudKey  ? `CLOUDINARY_API_KEY=${cloudKey}`     : "# CLOUDINARY_API_KEY="}
${cloudSecret ? `CLOUDINARY_API_SECRET=${cloudSecret}` : "# CLOUDINARY_API_SECRET="}

STRICT_BUILD_CHECKS=true
CLUSTER_PARITY_CHECK_ENABLED=true
MIXED_MODE_GUARD_ENABLED=false
`;

  // ── Write client .env.production ─────────────────────────────────────────
  const clientEnv = `NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.${domain}/api/v1
INTERNAL_API_URL=https://api.${domain}/api/v1
NEXT_PUBLIC_PLATFORM_NAME=NMPL
NEXT_PUBLIC_SUPPORT_EMAIL=support@${domain}
NEXT_PUBLIC_ENABLE_NATIVE_CONFIRM=false
`;

  const serverOut = path.join(__dirname, "..", "src", "server", ".env.production");
  const clientOut = path.join(__dirname, "..", "src", "client", ".env.production");

  fs.writeFileSync(serverOut, serverEnv);
  fs.writeFileSync(clientOut, clientEnv);

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  ✅ Done!                                                     ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(`\n  Server env → ${serverOut}`);
  console.log(`  Client env → ${clientOut}`);
  console.log("\n  Next steps:");
  console.log("  1. Set GitHub Actions secrets (see PRODUCTION_LAUNCH_CHECKLIST.md)");
  console.log("  2. Set up SSL certs (see src/nginx/README.md)");
  console.log("  3. Push to main → CI/CD deploys automatically\n");
}

main().catch((err) => { console.error(err); process.exit(1); });
