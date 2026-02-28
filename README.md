# NMPL Ecom

Full-stack ecommerce platform for NMPL with role-based workflows (`SUPERADMIN`, `ADMIN`, `USER`) and dealer lifecycle features.

## Most Important Setup Steps

Choose one mode only:
- `Docker mode` (recommended)
- `Node mode` (no Docker)

Do not run both at the same time on the same ports.

## 1) Docker Mode (Fastest)

### A. First-time setup

```bash
git clone https://github.com/ZeekyGeekFreelance/NMPL_Ecom.git
cd NMPL_Ecom
```

```powershell
Copy-Item src/.env.example src/.env
Copy-Item src/server/.env.example src/server/.env
Copy-Item src/client/.env.example src/client/.env
```

Set `src/.env`:

```env
POSTGRES_USER=jhaecom
POSTGRES_PASSWORD=jhaecom27
POSTGRES_DB=b2c_ecommerce
```

Set required values in `src/server/.env`:

```env
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
- PostgreSQL running locally
- Redis running locally

### A. First-time setup

```bash
git clone https://github.com/ZeekyGeekFreelance/NMPL_Ecom.git
cd NMPL_Ecom
```

```powershell
Copy-Item src/server/.env.example src/server/.env
Copy-Item src/client/.env.example src/client/.env
```

Set `src/server/.env` for local services:

```env
DATABASE_URL=postgresql://<db_user>:<db_password>@localhost:5432/b2c_ecommerce
REDIS_URL=redis://localhost:6379
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
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

If Docker Postgres is used from host tools, use `127.0.0.1:5433` to avoid collision with local Windows Postgres service:

```env
DATABASE_URL=postgresql://jhaecom:jhaecom27@127.0.0.1:5433/b2c_ecommerce
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

## Conflict-Free Rules

- Do not run Docker stack and local PostgreSQL/Redis on the same ports simultaneously.
- If Docker mode is active, stop it before Node mode:

```bash
cd src
docker compose down
```

- Migration must run before seed.
- Seed resets existing data (users/orders/products), so use only when intended.

## Fast Recovery After Docker Reset

If Docker data/volumes are deleted, recover with:

```bash
cd src
docker compose up -d --build
docker compose exec server npx prisma migrate deploy
docker compose exec server npm run seed
```
