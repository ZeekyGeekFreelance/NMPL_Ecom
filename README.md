# NMPL Ecom

Full-stack ecommerce platform for NMPL with role-based workflows (`SUPERADMIN`, `ADMIN`, `USER`, `DEALER`) across a Next.js client and an Express/Apollo/Prisma API.

## Production Docs

Supported production topology:

- API on Railway
- Client on Vercel
- Docker Compose for development only
- Managed TLS on Railway and Vercel only

Production failure policy:

- the API container must fail closed if the real server cannot boot
- the diagnostic health server is manual-only via `npm --prefix ./src/server run diag:health`
- a healthy production `/health` response must come from the real API, never from a fallback process

- [Quick Start Production Guide](QUICK_START_PRODUCTION.md)
- [Detailed Production Deployment](PRODUCTION_DEPLOYMENT.md)
- [Environment Source Of Truth](ENVIRONMENT_SOURCE_OF_TRUTH.md)
- [Security Checklist](SECURITY_CHECKLIST.md)
- [Production Launch Checklist](PRODUCTION_LAUNCH_CHECKLIST.md)
- [Monitoring Setup](MONITORING_SETUP.md)
- [Privileged Access Runbook](PRIVILEGED_ACCESS_RUNBOOK.md)

## Working Dev Baseline

This repository is currently locked around the following local development ports:

- Client: `http://localhost:3000`
- Server health: `http://localhost:5000/health`
- REST API: `http://localhost:5000/api/v1`
- GraphQL: `http://localhost:5000/api/v1/graphql`
- Postgres (Docker dev): `localhost:5433`
- Redis (Docker dev): `localhost:6379`

Use Node.js `22.x` for host-based commands.

## Recommended Setup: Docker Dev

This is the most reproducible path for a fresh clone on a standalone machine.
It runs:

- local Postgres 15 in Docker
- local Redis 7 in Docker
- server in Docker on port `5000`
- client in Docker on port `3000`

### 1. Clone and copy env files

```bash
git clone https://github.com/ZeekyGeekFreelance/NMPL_Ecom.git
cd NMPL_Ecom
```

```powershell
Copy-Item src/server/.env.example src/server/.env
Copy-Item src/client/.env.example src/client/.env
```

Notes:

- `src/docker-compose.yml` overrides the server database and redis URLs to the local Docker services.
- `src/client/.env.example` already points the client to `http://localhost:5000/api/v1`.
- In development, placeholder secrets from `src/server/.env.example` are acceptable, but replace them before any shared or staging deployment.

### 2. Start the stack

```bash
cd src
docker compose up -d --build
docker compose exec server npx prisma migrate deploy
docker compose exec server npm run seed
```

### 3. Verify

```bash
curl.exe http://localhost:5000/health
curl.exe -I http://localhost:3000/
curl.exe -I http://localhost:3000/sign-in
```

Expected result:

- `/health` returns a JSON payload with `"healthy": true`
- `/` returns `200`
- `/sign-in` returns `200`

### 4. Seeded login accounts

- `superadmin@example.com` / `password123`
- `admin@example.com` / `password123`
- `user@example.com` / `password123`

## Host Dev With Local Node Processes

Two host-side server profiles are supported.

### Option A: Host App + Local Docker Postgres/Redis

Use Docker only for infra:

```bash
cd src
docker compose up -d db redis
```

In another shell:

```bash
cd src/server
npm ci
npx prisma migrate deploy
npm run seed
npm run dev:localdocker
```

In another shell:

```bash
cd src/client
npm ci
npm run dev
```

### Option B: Host App + Neon

Run the app directly on the host with the base `src/server/.env`:

```bash
cd src/server
npm ci
npm run dev:neon
```

In another shell:

```bash
cd src/client
npm ci
npm run dev
```

For host mode:

- keep `src/server/.env` on port `5000`
- keep `src/client/.env` on `http://localhost:5000/api/v1`
- `npm run dev:neon` uses the base `src/server/.env`
- `npm run dev:localdocker` overlays `src/server/.env.localdocker` on top of `src/server/.env` so the host server targets Docker Postgres/Redis on `127.0.0.1`
- do not run the Docker client/server and the host client/server on the same ports at the same time
- do not run migrations or seed against Neon unless that is intentional

## Migrate Local Docker State To Neon

If your current source of truth is the local Docker Postgres volume on `localhost:5433`
and you want to promote that exact state into Neon:

```bash
npm run db:migrate:localdocker:to:neon:plan
```

Then execute the migration:

```bash
npm run db:migrate:localdocker:to:neon
```

How it works:

- source: `src/server/.env.localdocker` (or `.env.localdocker.example`) using the local direct Postgres URL
- target: `src/server/.env` using `DIRECT_URL` for Neon
- engine: Dockerized `pg_dump` + `pg_restore`, so you do not need host PostgreSQL client tools installed

Safety rules:

- the target Neon connection must be `DIRECT_URL`, not the pooled `DATABASE_URL`
- the restore is destructive for conflicting target objects because it uses `pg_restore --clean --if-exists`
- if your local DB still contains seeded demo accounts like `superadmin@example.com`, `admin@example.com`, or `user@example.com`, do not promote that state directly into production Neon
- use a disposable Neon branch first, validate login/catalog/order flows there, then cut over production

Recommended Neon contract:

- `DATABASE_URL` = pooled Neon URL
- `DIRECT_URL` = non-pooled Neon URL

## Bootstrap First SuperAdmin / Admin In Neon

For the full operational runbook for privileged account creation, password
rotation, and break-glass recovery, see:

- [Privileged Access Runbook](PRIVILEGED_ACCESS_RUNBOOK.md)

Neon does not need any special role configuration. The application accepts
privileged logins only when the `User` table contains a row with `role=SUPERADMIN`
or `role=ADMIN`.

Public registration never creates those roles.

If you migrated your local state, your existing privileged users move with that data.
If Neon is blank, bootstrap the first privileged account manually:

```bash
npm run bootstrap:privileged -- SUPERADMIN owner@nmpl.online "Owner Name" "TempPass1!" 9190362986
```

Or create a temporary admin:

```bash
npm run bootstrap:privileged -- ADMIN admin@nmpl.online "Admin Name" "TempPass1!" 9190362986
```

Fastest recommended path:

1. Create exactly one `SUPERADMIN` with the bootstrap script.
2. Sign in with that temporary password.
3. Complete the forced password change.
4. Create all later `ADMIN` accounts from inside the app, not from SQL.

Bootstrap rules:

- the script is non-destructive and refuses to overwrite an existing email
- both `SUPERADMIN` and `ADMIN` are created with `mustChangePassword=true`
- the first sign-in returns `requiresPasswordChange=true`, and the user must finish `/auth/change-password` before panel access
- after the first `SUPERADMIN` exists, create all later `ADMIN` accounts from the app itself via `POST /api/v1/users/admin`

### Direct Neon SQL Option

Yes, you can create the first privileged user directly from the Neon SQL editor.
The app only cares that the row exists in the `User` table with the correct role,
hashed password, and `mustChangePassword=true`.

Use this only for the very first bootstrap if you do not want to run the script.
Do **not** store a plain-text password in the database.

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO "User" (
  "id",
  "email",
  "password",
  "name",
  "phone",
  "role",
  "tokenVersion",
  "mustChangePassword",
  "isBillingSupervisor",
  "createdAt",
  "updatedAt"
)
VALUES (
  gen_random_uuid(),
  'owner@nmpl.online',
  crypt('TempPass1!', gen_salt('bf', 12)),
  'Owner Name',
  '9190362986',
  'SUPERADMIN'::"ROLE",
  0,
  TRUE,
  FALSE,
  NOW(),
  NOW()
);
```

To create an admin instead, change:

- `'SUPERADMIN'::"ROLE"` to `'ADMIN'::"ROLE"`
- email / name / phone / temporary password to the intended values

Important SQL rules:

- never insert a plain password; always bcrypt-hash it
- set `"mustChangePassword" = TRUE`
- do not manually promote an existing public user to `ADMIN` or `SUPERADMIN` in production unless you intend to bypass the normal audit trail
- after the first `SUPERADMIN` exists, stop doing this in SQL and create later admins from the app

## Local Built Preview

If you want to test a production build locally, do not use the plain production
client build against the seeded dev stack. The client `build/start` path uses
production env semantics and can otherwise point at the production API while the
server still points at a different local or Neon database.

Use these explicit preview commands instead:

```bash
cd src/server
npm run build
npm run start:preview:localdocker
```

In another shell:

```bash
cd src/client
npm run build:preview
npm run start:preview
```

Notes:

- `npm run start:preview:localdocker` runs the compiled server in production mode while still targeting the local Docker Postgres/Redis profile from `src/server/.env.localdocker`.
- `npm run start:preview:neon` is available if you intentionally want the compiled server to use the base Neon profile from `src/server/.env`.
- `npm run build:preview` / `npm run start:preview` force the built Next client to keep using `src/client/.env` localhost API settings instead of `src/client/.env.production`.
- The plain client `npm run build` is still the deployment-oriented production build path.

## Privileged Account Policy

For production safety:

- keep only one or two `SUPERADMIN` accounts, owned by named humans
- create `ADMIN` accounts only from a signed-in `SUPERADMIN`
- every newly created `ADMIN` now lands with `mustChangePassword=true`, so the initial password is temporary only
- every SuperAdmin-driven admin password reset now forces first-login rotation before the admin can use the panel
- public forgot/reset remains blocked for `ADMIN` and `SUPERADMIN`
- keep `SUPERADMIN_RESET_SECRET` in a password manager and use it only as break-glass recovery when a SuperAdmin is locked out
- never carry seeded demo credentials into shared Neon or production

## Reproducibility Notes

- The Docker dev client now stores `.next` in a dedicated container volume instead of the host bind mount.
- The client dev startup clears stale `.next` contents before `next dev` starts.
- The Docker dev client uses Turbopack so route-to-route navigation does not repeatedly fall back to slow webpack recompiles on bind-mounted source trees.
- If you switch branches or recover from an interrupted client build, recreating only the client is enough:

```bash
cd src
docker compose up -d --force-recreate --no-deps client
```

## Common Commands

```bash
cd src
docker compose ps
docker compose logs -f client
docker compose logs -f server
docker compose down
```

## Tests

Repository-level test entrypoint:

```bash
npm run test
```

Package-level test entrypoints:

```bash
npm --prefix ./src/server run test
npm --prefix ./src/client run test
```

Live smoke and browser suites against a booted local stack:

```bash
npm run test:smoke:api
npm run test:browser
npm run test:live
```

Live suite assumptions:

- API is already booted at `http://127.0.0.1:5000` unless `SMOKE_API_BASE_URL` overrides it.
- Client is already booted at `http://127.0.0.1:3000` unless `BROWSER_BASE_URL` overrides it.
- Default admin smoke credentials are `admin@example.com / password123` unless `SMOKE_ADMIN_EMAIL`, `SMOKE_ADMIN_PASSWORD`, `BROWSER_ADMIN_EMAIL`, or `BROWSER_ADMIN_PASSWORD` override them.
- Browser tests use a locally installed Chromium-family browser through Playwright. Override the channel with `PLAYWRIGHT_BROWSER_CHANNEL` if needed.

## Run Rules

- Run migrations before seeding.
- Do not run Docker mode and host mode simultaneously on the same ports.
- Development seed behavior is environment-routed in `src/server/seeds/seed.ts`.
- Production catalog import still requires explicit `ALLOW_PROD_CATALOG_IMPORT=true`.
