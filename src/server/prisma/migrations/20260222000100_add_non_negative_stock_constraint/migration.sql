DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_variant_stock_non_negative'
  ) THEN
    ALTER TABLE "ProductVariant"
    ADD CONSTRAINT "product_variant_stock_non_negative"
    CHECK ("stock" >= 0) NOT VALID;
  END IF;
END
$$;
