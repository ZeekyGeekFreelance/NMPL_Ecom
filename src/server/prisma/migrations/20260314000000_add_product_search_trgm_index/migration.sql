-- Enable pg_trgm extension for trigram-based similarity search.
-- This allows ILIKE '%query%' to use a GIN index instead of a full sequential scan.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on Product.name — covers the primary search field.
CREATE INDEX IF NOT EXISTS "Product_name_trgm_idx"
  ON "public"."Product" USING GIN ("name" gin_trgm_ops);

-- GIN trigram index on Product.description — covers secondary search field.
CREATE INDEX IF NOT EXISTS "Product_description_trgm_idx"
  ON "public"."Product" USING GIN ("description" gin_trgm_ops);
