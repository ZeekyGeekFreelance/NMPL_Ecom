# NMPL Ecom

Full-stack ecommerce platform with role-based workflows for `SUPERADMIN`, `ADMIN`, `USER`, and dealer operations.

## Repository

```bash
git clone https://github.com/ZeekyGeekFreelance/NMPL_Ecom.git
cd NMPL_Ecom
```

## Tech Stack

- Client: Next.js, TypeScript, Redux Toolkit, Tailwind CSS
- Server: Express, TypeScript, Prisma
- Data: PostgreSQL, Redis
- Runtime: Docker Compose

## Core Features (Current Version)

- Authentication and authorization with role-based access.
- Dealer registration request flow with OTP verification.
- Dealer approval/rejection lifecycle handled by admin roles.
- Dealer-specific pricing management with default vs custom pricing.
- Transaction dashboard with detail view.
- Search and sorting improvements across dashboard tables.
- Email notifications for key dealer and account actions.

## Project Structure

```text
src/
  client/        # Next.js app
  server/        # Express API + Prisma
  docker-compose.yml
collections/     # Postman collections
```

## Environment Setup

### Root (`src/.env`)

```env
POSTGRES_USER=jhaecom
POSTGRES_PASSWORD=jhaecom27
POSTGRES_DB=b2c_ecommerce
```

### Server (`src/server/.env`)

Use values matching your run mode:
- local host-run: `localhost:5432` and `localhost:6379`
- docker-compose: `db:5432` and `redis:6379`

## Run with Docker

```bash
cd src
docker compose up -d --build
```

## App URLs

- Client: `http://localhost:3000`
- Server API: `http://localhost:5000/api/v1`
- GraphQL: `http://localhost:5000/api/v1/graphql`

## Seed Data

From `src/server`:

```bash
npm run seed
```

Default test accounts:
- `superadmin@example.com` / `password123`
- `admin@example.com` / `password123`
- `user@example.com` / `password123`
