# NMPL Ecom

Full-stack ecommerce platform for NMPL with role-based workflows (`SUPERADMIN`, `ADMIN`, `USER`, `DEALER`) across a Next.js client and an Express/Apollo/Prisma API.

## Production Docs

Supported production topology:

- API on Railway
- Client on Vercel
- Docker Compose for development only
- Managed TLS on Railway and Vercel only

- [Quick Start Production Guide](QUICK_START_PRODUCTION.md)
- [Detailed Production Deployment](PRODUCTION_DEPLOYMENT.md)
- [Environment Source Of Truth](ENVIRONMENT_SOURCE_OF_TRUTH.md)
- [Security Checklist](SECURITY_CHECKLIST.md)
- [Production Launch Checklist](PRODUCTION_LAUNCH_CHECKLIST.md)
- [Monitoring Setup](MONITORING_SETUP.md)

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

If you want hot reload on the host but still want reproducible infra, use Docker only for Postgres and Redis:

```bash
cd src
docker compose up -d db redis
```

In another shell:

```bash
cd src/server
npm ci
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run dev
```

In another shell:

```bash
cd src/client
npm ci
npm run dev
```

For this mode:

- keep `src/server/.env` on port `5000`
- keep `src/client/.env` on `http://localhost:5000/api/v1`
- do not run the Docker client/server and the host client/server on the same ports at the same time

## Reproducibility Notes

- The Docker dev client now stores `.next` in a dedicated container volume instead of the host bind mount.
- The client dev startup clears stale `.next` contents before `next dev` starts.
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

## Run Rules

- Run migrations before seeding.
- Do not run Docker mode and host mode simultaneously on the same ports.
- Development seed behavior is environment-routed in `src/server/seeds/seed.ts`.
- Production catalog import still requires explicit `ALLOW_PROD_CATALOG_IMPORT=true`.
