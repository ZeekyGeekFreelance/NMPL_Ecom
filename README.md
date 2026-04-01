# NMPL E-Commerce — v50

A production-grade, full-stack e-commerce platform built with **Next.js 15** (App Router) + **Express/GraphQL** backend.

---

## Architecture

```
NMPL_Ecom/
├── src/
│   ├── client/          # Next.js 15 — App Router, TypeScript, Tailwind CSS
│   └── server/          # Express 4 — Apollo GraphQL, Prisma, PostgreSQL, Redis
├── package.json         # Root monorepo convenience scripts
└── README.md
```

### Frontend (`src/client`)
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15.x (App Router, React 19) |
| Styling | Tailwind CSS v4 |
| State | Redux Toolkit + RTK Query |
| API | Apollo Client (GraphQL) + Axios (REST) |
| Auth | Cookie-based JWT with CSRF protection |
| Payments | Stripe.js |
| Forms | React Hook Form + Zod |

### Backend (`src/server`)
| Layer | Technology |
|-------|-----------|
| Runtime | Node.js ≥22 |
| HTTP | Express 4 |
| API | Apollo Server 5 (GraphQL) |
| ORM | Prisma 6 + PostgreSQL |
| Cache/Queue | Redis (ioredis) + BullMQ |
| Payments | Stripe |
| Storage | Cloudinary |
| Auth | JWT (bcryptjs) + CSRF |
| Email | Nodemailer |

---

## Routes

### Public
| Path | Description |
|------|-------------|
| `/` | Home — SSR product sections |
| `/products` | Product listing with filters |
| `/product/[slug]` | Product detail page |
| `/shop` | Shop by category |
| `/brands` | Brand browser |
| `/cart` | Shopping cart |
| `/about-us` | About page |

### Auth
| Path | Description |
|------|-------------|
| `/sign-in` | User login |
| `/sign-up` | User registration |
| `/password-reset` | Password reset flow |
| `/dealer/sign-in` | Dealer portal login |
| `/dealer/register` | Dealer registration |

### Private (authenticated)
| Path | Description |
|------|-------------|
| `/orders` | Order history |
| `/orders/[orderId]` | Order detail |
| `/profile` | User profile |
| `/dashboard` | Admin dashboard |
| `/dashboard/products` | Product management |
| `/dashboard/categories` | Category management |
| `/dashboard/orders` | Order management |
| `/dashboard/users` | User management |
| `/dashboard/analytics` | Analytics & charts |
| `/dashboard/payments` | Payment management |
| `/dashboard/inventory` | Inventory & restock |
| `/dashboard/transactions` | Transaction history |
| `/dashboard/reports` | Reports & exports |
| `/dashboard/dealers` | Dealer management |
| `/dashboard/gst` | GST configuration |
| `/dashboard/attributes` | Product attributes |
| `/dashboard/delivery-fees` | Delivery fee config |
| `/dashboard/logs` | System logs |

---

## Quick Start

### Prerequisites
- Node.js ≥ 22
- PostgreSQL
- Redis

### 1. Client

```bash
cd src/client
cp .env.example .env.local
# Fill in your NEXT_PUBLIC_API_URL, NEXT_PUBLIC_PLATFORM_NAME, etc.
npm install
npm run dev        # http://localhost:3000
```

### 2. Server

```bash
cd src/server
cp .env.example .env
# Fill in DATABASE_URL, REDIS_URL, JWT secrets, Stripe keys, etc.
npm install
npx prisma migrate deploy
npm run dev        # http://localhost:5000
```

---

## Environment Variables

### Client (`src/client/.env.local`)
```env
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
INTERNAL_API_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_PLATFORM_NAME=NMPL
NEXT_PUBLIC_SUPPORT_EMAIL=support@nmpl.online
NEXT_PUBLIC_ENABLE_NATIVE_CONFIRM=false
```

### Server (`src/server/.env`)
See `src/server/.env.example` for the full list.
Key variables:
```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
ACCESS_TOKEN_SECRET=...
REFRESH_TOKEN_SECRET=...
STRIPE_SECRET_KEY=...
CLOUDINARY_URL=...
```

---

## Production Build

```bash
# Client
cd src/client && npm run build && npm start

# Server
cd src/server && npm run build && npm start
```

The client produces a `standalone` Next.js output in `.next/standalone` — ready for Docker or direct Node deployment.

---

## Docker

Use `src/docker-compose.yml` to spin up client + server + PostgreSQL + Redis + nginx together.

```bash
cd src
docker compose up --build
```

---

## Key Business Logic

- **Products**: Variants with SKU, price, stock, images, attributes (e.g. brand, color, size)
- **Catalog Flags**: `isFeatured`, `isTrending`, `isNew`, `isBestSeller`
- **Pricing**: Dealer-specific pricing mapped per variant; fallback to list price
- **Cart**: Guest cart (localStorage) + authenticated cart (server-side); merged on login
- **Checkout**: Stripe payment intent + optional Pay Later for approved dealers
- **Orders**: Full lifecycle — pending → confirmed → shipped → delivered → cancelled
- **Dealers**: Registration with approval flow; credit terms; pay-later support
- **GST**: Per-product GST slabs; applied at checkout
- **Delivery**: City-based flat rates; free pickup option
- **Reports**: Sales, inventory, financial exports (PDF/CSV)
- **Auth**: Access token (15 min) + refresh token (24 h); CSRF protection; token versioning

---

## Changes from v12 → v50

| Area | v12 | v50 |
|------|-----|-----|
| Client scripts | Custom `run-next.js` wrapper, `validate-env.js`, `assert-determinism.js` | Standard `next dev / build / start` |
| Build complexity | Multi-step pipeline with sanity checks | Lean standard Next.js build |
| tsconfig | References `.next-dev` dist dir | Clean, references only `.next` |
| next.config.ts | NEXT_DIST_DIR / isDockerDev branching | Single clean config |
| Root package.json | Mono scripts | Clean workspace convenience scripts |
| Route conflicts | None (App Router enforces unique routes) | Verified clean |

---

## License

Proprietary — © NMPL
