# Railway Production Environment Variables
# ─────────────────────────────────────────────────────────────────────────────
# HOW TO USE THIS FILE
#
# 1. Open Railway dashboard → your project → server service → Variables tab.
# 2. Add every variable in the SERVER section below.
# 3. Repeat for the client service with the CLIENT section.
# 4. Push to main. Railway builds and deploys.
#
# Rules:
#   - Never commit real secret values to this file or anywhere in the repo.
#   - The non-secret vars in railway.toml are already set for you.
#     Only the secret/URL variables below need manual entry in the dashboard.
#   - After changing any variable, Railway will auto-redeploy the service.
# ─────────────────────────────────────────────────────────────────────────────

# ════════════════════════════════════════════════════════════════════════════
# SERVER SERVICE VARIABLES
# (Railway dashboard → server → Variables)
# ════════════════════════════════════════════════════════════════════════════

# ── Database (Railway Postgres plugin) ─────────────────────────────────────
# Add the Postgres plugin from the Railway dashboard.
# Railway automatically injects DATABASE_URL into your server service.
# You do NOT set DATABASE_URL manually — Railway handles it.
#
# DIRECT_URL is no longer needed. Railway Postgres is a plain direct connection,
# no pgbouncer. The schema.prisma directUrl field has been removed.
#
# The only database variable you need to set manually:
DB_SSL_REQUIRED=true

# ── Redis (Railway Redis plugin) ────────────────────────────────────────────
# Add the Redis plugin from the Railway dashboard.
# Railway automatically injects REDIS_URL into your server service.
# You do NOT set REDIS_URL manually — Railway handles it.
# The only Redis variable you need to set manually:
REDIS_ENABLED=true

# ── Secrets (generate each with: openssl rand -hex 64) ─────────────────────
SESSION_SECRET=<generate>
COOKIE_SECRET=<generate>
ACCESS_TOKEN_SECRET=<generate>
REFRESH_TOKEN_SECRET=<generate>

# ── Public-facing URLs ──────────────────────────────────────────────────────
# Railway assigns domains like: https://server-production-xxxx.up.railway.app
# Use your custom domain here if you have one attached.
PUBLIC_API_BASE_URL=https://<your-server-domain>
ALLOWED_ORIGINS=https://<your-client-domain>
CLIENT_URL_PROD=https://<your-client-domain>
CLIENT_URL_DEV=https://<your-client-domain>

# ── Email ───────────────────────────────────────────────────────────────────
# Resend.com is the simplest option — free tier covers most small deployments.
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASS=<your-resend-api-key>
EMAIL_FROM=noreply@<yourdomain.com>
EMAIL_FROM_NAME=NMPL
EMAIL_SERVICE=smtp
SUPPORT_EMAIL=support@<yourdomain.com>
BILLING_NOTIFICATION_EMAILS=billing@<yourdomain.com>
PLATFORM_NAME=NMPL

# ── Stripe ──────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_<your-key>
STRIPE_WEBHOOK_SECRET=whsec_<your-secret>

# ── Cloudinary ──────────────────────────────────────────────────────────────
# Cloudinary is required — Railway has no file/image storage.
# Free tier: 25GB storage, 25GB bandwidth/month. Covers 9000 variants easily.
# Sign up at cloudinary.com, go to Dashboard → copy these three values.
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
CLOUDINARY_API_KEY=<your-api-key>
CLOUDINARY_API_SECRET=<your-api-secret>

# ── Auth tokens ─────────────────────────────────────────────────────────────
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_ABS_TTL_SECONDS=86400

# ── CSP ─────────────────────────────────────────────────────────────────────
CSP_DIRECTIVES=default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; connect-src 'self' https:; font-src 'self' data:

# ── Delivery config ─────────────────────────────────────────────────────────
BANGALORE_CITY_ALIASES=BANGALORE,BENGALURU
BANGALORE_DELIVERY_CHARGE=75
PICKUP_STORE_NAME=NMPL Pickup Desk
PICKUP_STORE_PHONE=9999999999
PICKUP_STORE_LINE1=Main Store
PICKUP_STORE_CITY=Bangalore
PICKUP_STORE_STATE=Karnataka
PICKUP_STORE_COUNTRY=India
PICKUP_STORE_PINCODE=560001

# ── Optional OAuth ───────────────────────────────────────────────────────────
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# GOOGLE_CALLBACK_URL_PROD=https://<your-server-domain>/api/v1/auth/google/callback
# FACEBOOK_APP_ID=
# FACEBOOK_APP_SECRET=
# FACEBOOK_CALLBACK_URL_PROD=https://<your-server-domain>/api/v1/auth/facebook/callback


# ════════════════════════════════════════════════════════════════════════════
# CLIENT SERVICE VARIABLES
# (Railway dashboard → client → Variables)
# ════════════════════════════════════════════════════════════════════════════

# These three are baked into the Next.js bundle at BUILD TIME.
# Railway automatically passes service variables as Docker build args.
NEXT_PUBLIC_API_URL=https://<your-server-domain>/api/v1
NEXT_PUBLIC_PLATFORM_NAME=NMPL
NEXT_PUBLIC_SUPPORT_EMAIL=support@<yourdomain.com>

# SSR calls the API over Railway's private network — faster, no egress cost.
INTERNAL_API_URL=http://server.railway.internal:5000/api/v1


# ════════════════════════════════════════════════════════════════════════════
# WHAT RAILWAY HANDLES AUTOMATICALLY (you do NOT set these)
# ════════════════════════════════════════════════════════════════════════════
#
#   DATABASE_URL  — injected when you add the Postgres plugin
#   REDIS_URL     — injected when you add the Redis plugin
#   HTTPS/SSL     — Railway terminates TLS on all services automatically
#   Domains       — Railway assigns *.up.railway.app subdomains automatically
#   Restarts      — handled by restartPolicyType = ON_FAILURE in railway.toml
#   Zero-downtime — Railway keeps old container alive until new one is healthy


# ════════════════════════════════════════════════════════════════════════════
# COOKIE / AUTH NOTES FOR RAILWAY SUBDOMAINS
# ════════════════════════════════════════════════════════════════════════════
#
# Railway default domains (*.up.railway.app) are different root domains
# per service. Cross-domain cookies require SameSite=None + Secure.
#
# railway.toml already sets:
#   COOKIE_SAMESITE=none
#   COOKIE_DOMAIN=    (empty — correct for Railway subdomains)
#
# If you attach a custom domain (api.yourdomain.com + app.yourdomain.com):
#   Change COOKIE_DOMAIN=.yourdomain.com
#   Change COOKIE_SAMESITE=lax
