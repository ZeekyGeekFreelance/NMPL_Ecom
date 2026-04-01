# NMPL E-Commerce — v50 (Unified Next.js 15 Architecture)

A production-grade, full-stack e-commerce platform built entirely on **Next.js 15** with **Prisma ORM**, **PostgreSQL**, and **React 19**. No separate backend server — everything runs in a single Next.js deployment.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Next.js 15 (Single App)                │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────┐  │
│  │  App Router  │    │  Route Hdlrs │    │  Prisma   │  │
│  │  (pages/UI)  │◄──►│  /api/*      │◄──►│  (DB ORM) │  │
│  └──────────────┘    └──────────────┘    └───────────┘  │
│         │                   │                            │
│         ▼                   ▼                            │
│  ┌──────────────┐    ┌──────────────┐                   │
│  │  RTK Query   │    │  Services    │                   │
│  │  (client)    │    │  lib/svc     │                   │
│  └──────────────┘    └──────────────┘                   │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
                    PostgreSQL (Neon / Railway / Local)
```

### What changed from v12

| v12 (old) | v50 (this branch) |
|-----------|-------------------|
| Express.js + Next.js (2 services) | **Single Next.js app** |
| nginx reverse proxy required | Not needed |
| `docker-compose` with 3+ containers | Single container / Vercel / Railway |
| Separate `src/server/` codebase | All server logic in `lib/` |
| Apollo GraphQL server + client | Next.js Route Handlers + RTK Query |
| `/api/v1/` prefix | `/api/` (same-origin) |
| `src/client/` + `src/server/` | Flat root-level structure |
| jwt via jsonwebtoken | JWT via `jose` (Edge-compatible) |
| BullMQ, Redis required | Not required (optional) |
| Turbopack/Docker wrapper scripts | `next dev` directly |

---

## Route Map (zero conflicts)

| URL | Description |
|-----|-------------|
| `/` | Home (SSR + hydration) |
| `/shop` | Shop listing with filters |
| `/products` | Product showcase page |
| `/product/[slug]` | Product detail |
| `/cart` | Shopping cart |
| `/about-us` | About page |
| `/brands` | Brands / Category browser |
| `/sign-in` | User sign-in |
| `/sign-up` | User registration |
| `/change-password` | Password change |
| `/password-reset` | Forgot password |
| `/password-reset/[token]` | Reset via token |
| `/dealer/sign-in` | Dealer sign-in |
| `/dealer/register` | Dealer registration |
| `/orders` | User order history |
| `/orders/[orderId]` | Order detail |
| `/profile` | User profile |
| `/payment-success` | Post-payment confirmation |
| `/dashboard` | Admin dashboard overview |
| `/dashboard/products` | Product management |
| `/dashboard/categories` | Category management |
| `/dashboard/attributes` | Attribute management |
| `/dashboard/inventory` | Stock management |
| `/dashboard/transactions` | Order transactions |
| `/dashboard/transactions/[id]` | Transaction detail |
| `/dashboard/payments` | Payment recording |
| `/dashboard/dealers` | Dealer management |
| `/dashboard/users` | User management |
| `/dashboard/analytics` | Analytics & stats |
| `/dashboard/gst` | GST rates |
| `/dashboard/delivery-fees` | Delivery rate config |
| `/dashboard/logs` | System logs |
| `/dashboard/reports` | Reports |
| `/maintenance` | Maintenance mode page |

---

## API Reference

All endpoints at `/api/` (same-origin — no CORS needed).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/sign-in` | — | Sign in |
| POST | `/api/auth/sign-out` | — | Sign out |
| POST | `/api/auth/sign-up` | — | Register |
| POST | `/api/auth/refresh-token` | — | Rotate tokens |
| POST | `/api/auth/forgot-password` | — | Send reset link |
| POST | `/api/auth/reset-password/[token]` | — | Reset password |
| POST | `/api/auth/change-password` | User | Change password |
| POST | `/api/auth/dealer/register` | — | Dealer register |
| GET | `/api/csrf` | — | Get CSRF token |
| GET/POST | `/api/products` | — / Admin | List / Create |
| GET/PUT/DELETE | `/api/products/[id]` | — / Admin | Product ops |
| GET | `/api/products/slug/[slug]` | — | By slug |
| GET/POST | `/api/cart` | User | Cart ops |
| GET | `/api/cart/count` | User | Cart count |
| PUT/DELETE | `/api/cart/item/[id]` | User | Update/remove |
| GET/POST | `/api/checkout` | User | Summary / Place order |
| GET | `/api/orders` | User | Order history |
| GET | `/api/orders/[id]` | User/Admin | Order detail |
| GET/POST | `/api/categories` | — / Admin | Categories |
| GET/POST | `/api/attributes` | — / Admin | Attributes |
| GET/POST | `/api/gst` | — / Admin | GST slabs |
| GET/POST | `/api/inventory` | Admin | Inventory / Restock |
| GET | `/api/analytics` | Admin | Dashboard analytics |
| GET | `/api/transactions` | Admin | Transactions |
| GET | `/api/dealers` | Admin | Dealers |
| GET/POST | `/api/payments` | Admin | Payments |
| GET/POST | `/api/logs` | Admin | System logs |
| GET/POST | `/api/delivery-rates` | — / Admin | Delivery rates |
| POST | `/api/upload` | Admin | File upload (Cloudinary) |
| GET/PUT | `/api/users/me` | User | Profile |
| GET/POST | `/api/users/me/addresses` | User | Addresses |
| DELETE | `/api/users/me/addresses/[id]` | User | Delete address |
| GET/POST | `/api/users` | Admin | User list / Create admin |

---

## Quick Start

### Prerequisites
- Node.js 22.x
- PostgreSQL database (Neon, Railway, Supabase, or local)

### 1. Clone & install

```bash
git clone https://github.com/ZeekyGeekFreelance/NMPL_Ecom.git
cd NMPL_Ecom
git checkout v50
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
# Edit .env.local with your values
```

### 3. Database setup

```bash
npx prisma migrate deploy   # run existing migrations
# OR for fresh dev setup:
npx prisma db push
npm run db:seed
```

### 4. Run development

```bash
npm run dev
# → http://localhost:3000
```

### 5. Build for production

```bash
npm run build
npm run start
```

---

## Project Structure

```
nmpl_ecom/
├── prisma/
│   ├── schema.prisma          # Full Prisma schema (778 lines)
│   └── seed.ts                # Dev seed data
│
├── lib/                       # Server-side business logic
│   ├── db.ts                  # Prisma client singleton
│   ├── config.ts              # Unified env config
│   ├── api.ts                 # Response helpers + AppError
│   ├── auth/
│   │   ├── tokens.ts          # JWT sign/verify (jose)
│   │   ├── session.ts         # httpOnly cookie management
│   │   ├── password.ts        # bcrypt utils
│   │   ├── csrf.ts            # CSRF token generation
│   │   └── guard.ts           # requireAuth / isAdmin
│   ├── email/
│   │   └── sender.ts          # Nodemailer wrapper
│   └── services/
│       ├── auth.service.ts    # Auth business logic
│       ├── product.service.ts # Product CRUD + dealer pricing
│       ├── cart.service.ts    # Cart management
│       ├── order.service.ts   # Checkout + order lifecycle
│       └── user.service.ts    # User + address management
│
├── src/
│   ├── middleware.ts           # Edge auth + route protection
│   └── app/
│       ├── layout.tsx          # Root layout
│       ├── page.tsx            # Home (SSR)
│       ├── providers.tsx       # Redux + Toast providers
│       ├── store/              # RTK Query + Redux slices
│       │   ├── store.ts
│       │   ├── api.slice.ts
│       │   ├── auth.slice.ts
│       │   ├── cart.slice.ts
│       │   ├── toast.slice.ts
│       │   └── endpoints/
│       │       ├── auth.ts
│       │       ├── cart.ts
│       │       ├── orders.ts
│       │       └── products.ts
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Navbar.tsx
│       │   │   ├── Footer.tsx
│       │   │   └── MainLayout.tsx
│       │   └── ui/
│       │       ├── ProductCard.tsx
│       │       ├── Toast.tsx
│       │       └── TopLoadingBar.tsx
│       ├── api/               # Route Handlers
│       ├── (auth)/            # Sign-in, sign-up, etc.
│       ├── (public)/          # Storefront pages
│       ├── (private)/         # Protected pages
│       └── maintenance/
│
├── .env.example
├── Dockerfile
├── next.config.ts
├── tsconfig.json
└── package.json               # Single package.json — no monorepo
```

---

## Security

- **JWT** stored in `httpOnly` cookies — XSS safe
- **CSRF** double-submit cookie pattern
- **bcrypt** password hashing (12 rounds)
- **jose** library — Edge Runtime compatible
- **Admin routes** role-checked in every handler and middleware
- **SQL injection** impossible — Prisma parameterized queries

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, React 19) |
| Database ORM | Prisma 6 |
| Database | PostgreSQL |
| Auth | JWT via `jose` + httpOnly cookies |
| State management | RTK Query + Redux Toolkit |
| UI | Tailwind CSS 4 + Lucide icons |
| File uploads | Cloudinary |
| Payments | Stripe |
| Email | Nodemailer |
| Language | TypeScript 5.8 |

---

## Deployment

### Vercel
1. Push `v50` branch to GitHub
2. Import in Vercel → set env vars → deploy

### Railway
1. Connect GitHub repo, select `v50` branch
2. Add env vars → auto-build & deploy

### Docker
```bash
docker build -t nmpl-ecom .
docker run -p 3000:3000 --env-file .env.local nmpl-ecom
```

---

## License

Proprietary — © NMPL
