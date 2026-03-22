# Production Quick Start

Supported production topology:

- API: Railway
- Client: Vercel
- Database: PostgreSQL provider of your choice
- Cache: managed Redis
- Local Docker Compose: development only

Environment source of truth:

- `ENVIRONMENT_SOURCE_OF_TRUTH.md`

## 1. Prerequisites

- Node.js 22.x
- npm 11.x
- Railway account and CLI login
- Vercel account and CLI login
- Managed PostgreSQL URL
- Managed Redis URL
- Production domain already delegated in DNS

## 2. Generate production env files

From the repo root:

```bash
npm run setup:prod
```

This creates:

- `src/server/.env.production`
- `src/client/.env.production`

Do not commit either file.

## 3. Configure Railway

Create or select the Railway project for `src/server`, then copy the values from `src/server/.env.production` into Railway's service variables.

Minimum required checks:

- `NODE_ENV=production`
- `DATABASE_URL` points to the production database
- `REDIS_URL` points to managed Redis
- `ALLOWED_ORIGINS` contains only the production frontend origins
- `COOKIE_DOMAIN` covers both the frontend and API hosts
- `ENABLE_MOCK_PAYMENT=false`
- `RAZORPAY_MOCK_MODE=false`

Deploy the API:

```bash
cd src/server
railway up
railway run npx prisma migrate deploy
```

Verify:

```bash
curl https://api.yourdomain.com/health
```

## 4. Configure Vercel

Create or select the Vercel project for `src/client`, then copy the values from `src/client/.env.production` into the Vercel project settings.

Required client variables:

- `NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1`
- `INTERNAL_API_URL=https://api.yourdomain.com/api/v1`
- `NEXT_PUBLIC_PLATFORM_NAME=NMPL`
- `NEXT_PUBLIC_SUPPORT_EMAIL=support@nmpl.online`

Deploy the client:

```bash
cd src/client
vercel --prod
```

## 5. Run the supported deploy workflow

After CI passes, the repo-level deploy script performs the gated production deploy:

```bash
npm run deploy
```

The script blocks on:

- repository sanity checks
- deterministic installs
- server build
- client production build
- dependency audit failures at `high` or above
- dependency license and install-script policy violations

## 6. Smoke-test the release

Run these checks against the live deployment:

```bash
curl https://api.yourdomain.com/health
curl -I https://yourdomain.com
curl -X POST https://api.yourdomain.com/api/v1/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { products { totalCount } }"}'
```

Validate in the browser:

- homepage loads
- product listing renders
- product detail renders
- sign-in works
- cart add/update works
- checkout starts
- admin dashboard loads

## Hard rules

- Do not deploy the client or API from Docker Compose.
- Do not use the archived nginx or VPS path for production.
- Do not enable mock payments in production.
- Do not permit wildcard CORS origins in production.
- Do not merge if `npm run audit:all` or `npm run licenses:check` fails.
