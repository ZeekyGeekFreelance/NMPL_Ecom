# Production Deployment Guide

This repository supports one production topology:

- API on Railway
- Client on Vercel
- Managed PostgreSQL
- Managed Redis

Legacy VPS, nginx, and production Docker Compose guidance is retired.

Environment source of truth:

- `ENVIRONMENT_SOURCE_OF_TRUTH.md`

## Architecture

### Client

- Built by Vercel from `src/client`
- Uses `NEXT_PUBLIC_API_URL` for browser requests
- Uses `INTERNAL_API_URL` for SSR requests

### API

- Built by Railway from `src/server`
- Serves REST, GraphQL, health, and auth endpoints
- Uses JWT cookies for browser auth
- Uses the `sessionId` cookie only for anonymous cart and request correlation state

### Data services

- PostgreSQL for durable data
- Redis for cache, coordination, and queue-related state

## Production invariants

- Node.js `22.x` only
- npm `11.x` only
- `package-lock.json` only
- exact dependency versions only
- zero `high` or `critical` audit findings
- zero deprecated production dependencies
- no unsupported production install scripts

## Environment ownership

### Railway

Railway owns all server runtime variables from `src/server/.env.production`.

Key variables:

- `DATABASE_URL`
- `DIRECT_URL`
- `REDIS_URL`
- `PUBLIC_API_BASE_URL`
- `ALLOWED_ORIGINS`
- `COOKIE_DOMAIN`
- `ACCESS_TOKEN_SECRET`
- `REFRESH_TOKEN_SECRET`
- `COOKIE_SECRET`
- `SUPERADMIN_RESET_SECRET`

### Vercel

Vercel owns all client build/runtime variables from `src/client/.env.production`.

Key variables:

- `NEXT_PUBLIC_API_URL`
- `INTERNAL_API_URL`
- `NEXT_PUBLIC_PLATFORM_NAME`
- `NEXT_PUBLIC_SUPPORT_EMAIL`
- `NEXT_PUBLIC_ENABLE_NATIVE_CONFIRM`

## CI contract

GitHub Actions workflow: `.github/workflows/ci.yml`

Every push and pull request to `main` must pass:

- `npm ci` at root, client, and server
- repo sanity checks
- server env validation
- client production env validation
- server build
- client build
- `npm run licenses:check`
- `npm run audit:all`

## First deployment

### 1. Generate env files

```bash
npm run setup:prod
```

### 2. Load server env into Railway

- create the Railway service from `src/server`
- copy variables from `src/server/.env.production`
- confirm the public API domain

### 3. Deploy and migrate the API

```bash
cd src/server
railway up
railway run npx prisma migrate deploy
```

Only seed production when explicitly required for a new environment.

### 4. Load client env into Vercel

- create the Vercel project from `src/client`
- copy variables from `src/client/.env.production`
- confirm the production domain mapping

### 5. Deploy the client

```bash
cd src/client
vercel --prod
```

## Supported release flow

Use the repo-level deploy script once both platforms are configured:

```bash
npm run deploy
```

The deploy script performs:

1. repository sanity
2. server install and build
3. client install and production build
4. dependency license policy
5. dependency audit gates
6. Railway deploy
7. Railway migrations
8. API health polling
9. Vercel deploy
10. final smoke test

## Rollback guidance

### API rollback

- redeploy the last known-good Railway release
- keep database rollbacks manual and migration-aware
- never delete production data to recover a bad release

### Client rollback

- promote the last known-good Vercel deployment
- confirm the client still targets the same API contract

## Post-deploy validation

Run or verify all of the following:

- `GET /health` returns healthy
- anonymous GraphQL catalog query succeeds without custom bypass headers
- sign-up and sign-in work with CSRF protection enabled
- logout works through `POST /api/v1/auth/sign-out`
- product browsing and product detail render correctly
- cart merge works after sign-in
- checkout and payment creation succeed
- admin analytics and reports export only supported formats
- CSV import remains available where enabled

## Unsupported production paths

The following are intentionally unsupported:

- `src/docker-compose.prod.yml`
- `src/nginx/*` as the active production ingress path
- GitHub Actions auto-deploy on push
- XLSX import/export in admin data flows
