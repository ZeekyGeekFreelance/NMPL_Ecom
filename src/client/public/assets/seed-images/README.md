# Seed Image Notes

This folder is a mirror of `assets/seed-images` for client-side static asset parity.

## Current status

- No active image files are required here right now.
- Current seed scripts do not read images from this directory:
  - `src/server/seeds/seed.ts`
  - `src/server/prisma/seed-dev.ts`
- Those scripts currently create `images: []` for categories and variants.

## Where images are currently sourced/generated

- Hero slider images are static files in:
  - `src/client/public/images/hero/`
- Brand and UI logos are static files in:
  - `src/client/public/images/branding/`
  - `src/client/app/assets/images/` (brand logos used via imports)
- Missing product/user visuals are generated at runtime in the client by:
  - `src/client/app/utils/placeholderImage.ts`

## If you want seed scripts to use local files

1. Place images in `src/client/public/images/...`
2. Store their public paths (for example `/images/hero/HeroSlide.png`) in DB seed records
3. Update seed scripts to write those paths into `images` fields

## Why this folder still exists

- Keeps a stable location for future seed-image workflows.
- Avoids broken references for teams that expect this mirror path.