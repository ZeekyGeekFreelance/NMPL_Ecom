# NMPL Ecom

Full-stack ecommerce platform for NMPL with role-based workflows (`SUPERADMIN`, `ADMIN`, `USER`) and dealer lifecycle features.

## Most Important Setup Steps

This project is now configured for **Neon Postgres only** (no local Postgres service).

Choose one mode only:
- `Docker mode` (recommended): runs app containers, uses external Neon DB
- `Node mode` (no Docker): runs app directly on host, uses external Neon DB

## Neon Connection Requirements

Use both URLs from your Neon project:

```env
# Pooled endpoint for app runtime
DATABASE_URL=postgresql://<neon_user>:<neon_password>@<neon_pooler_host>/<db_name>?sslmode=require&pgbouncer=true&connection_limit=20&pool_timeout=20

# Direct endpoint for Prisma migrate/status
DIRECT_URL=postgresql://<neon_user>:<neon_password>@<neon_direct_host>/<db_name>?sslmode=require

DB_SSL_REQUIRED=true
```

## 1) Docker Mode (Fastest)

### A. First-time setup

```bash
git clone https://github.com/ZeekyGeekFreelance/NMPL_Ecom.git
cd NMPL_Ecom
```

```powershell
Copy-Item src/server/.env.example src/server/.env
Copy-Item src/client/.env.example src/client/.env
```

Set required values in `src/server/.env`:

```env
DATABASE_URL=<your_neon_pooled_url>
DIRECT_URL=<your_neon_direct_url>
DB_SSL_REQUIRED=true
DB_ENV=development
SESSION_SECRET=change_me
COOKIE_SECRET=change_me
ACCESS_TOKEN_SECRET=change_me
REFRESH_TOKEN_SECRET=change_me
NODE_ENV=development
PORT=5000
SMS_PROVIDER=LOG
```

### B. Run

```bash
cd src
docker compose up -d --build
docker compose exec server npx prisma migrate deploy
docker compose exec server npm run seed
```

### C. Verify

```bash
curl.exe http://localhost:5000/health
curl.exe -X POST http://localhost:5000/api/v1/graphql -H "Content-Type: application/json" -d "{\"query\":\"query { products { totalCount } }\"}"
```

## 2) Node Mode (No Docker)

Prerequisites:
- Node.js 22+
- Neon Postgres project (pooled + direct URLs)
- Redis (local or managed)

### A. First-time setup

```bash
git clone https://github.com/ZeekyGeekFreelance/NMPL_Ecom.git
cd NMPL_Ecom
```

```powershell
Copy-Item src/server/.env.example src/server/.env
Copy-Item src/client/.env.example src/client/.env
```

Set `src/server/.env`:

```env
DATABASE_URL=<your_neon_pooled_url>
DIRECT_URL=<your_neon_direct_url>
DB_SSL_REQUIRED=true
DB_ENV=development
REDIS_URL=redis://localhost:6379
NODE_ENV=development
PORT=5000
ALLOWED_ORIGINS=http://localhost:3000
CLIENT_URL_DEV=http://localhost:3000
SESSION_SECRET=change_me
COOKIE_SECRET=change_me
ACCESS_TOKEN_SECRET=change_me
REFRESH_TOKEN_SECRET=change_me
SMS_PROVIDER=LOG
```

Install dependencies:

```bash
cd src/server
npm ci
cd ../client
npm ci
```

### B. Run migrations and seed

```bash
cd src/server
npx prisma generate
npx prisma migrate deploy
npm run seed
```

### C. Start apps

Terminal 1:
```bash
cd src/server
npm run dev
```

Terminal 2:
```bash
cd src/client
npm run dev
```

## URLs

- Client: `http://localhost:3000`
- REST API: `http://localhost:5000/api/v1`
- GraphQL: `http://localhost:5000/api/v1/graphql`

## Seeded Login Accounts

- `superadmin@example.com` / `password123`
- `admin@example.com` / `password123`
- `user@example.com` / `password123`

## Run Rules

- Do not run Docker mode and Node mode at the same time on the same ports.
- Migration must run before seed.
- Seeding is environment-routed (`prisma/seed.ts`): dev runs `seed-dev`, production runs `import-catalog`.
- Dev cleanup (`deleteMany`) only runs when `SEED_RESET=true`.
- Production catalog import requires explicit `ALLOW_PROD_CATALOG_IMPORT=true`.
