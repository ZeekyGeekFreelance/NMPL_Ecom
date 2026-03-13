# Production Catalog Source

Place the real sewing catalog dataset in:

- `prisma/catalog/sewing-products.json`

Expected contract:

- `products` array must contain exactly `1213` products.
- Each product must include a unique `slug`.
- Each variant must include a globally unique `sku`.
- This dataset is consumed by `prisma/import-catalog.ts` using idempotent `upsert` operations only.

This file is intentionally environment-agnostic and must represent production catalog data only.
