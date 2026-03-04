# Seeding Architecture (Strict Split)

Seeding is orchestrated from `prisma/seed.ts` and split by environment:

- `prisma/seed.ts` -> orchestrator only
- `prisma/seed-dev.ts` -> minimal development dummy data
- `prisma/import-catalog.ts` -> production catalog import (idempotent, upsert-only)

`seeds/seed.ts` is a compatibility proxy that forwards to the orchestrator.

## Commands

```bash
npm run seed
npm run seed:dev
npm run seed:catalog
```

## Safety Notes

- `DB_ENV` must be explicit (`development` or `production`).
- `seed-dev` is blocked for production contexts.
- `import-catalog` is blocked unless `NODE_ENV=production`, `DB_ENV=production`, and `ALLOW_PROD_CATALOG_IMPORT=true`.
- Production catalog import uses upserts only and never runs `deleteMany`.
