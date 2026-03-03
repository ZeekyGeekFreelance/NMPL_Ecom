CREATE INDEX IF NOT EXISTS "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX IF NOT EXISTS "Product_createdAt_idx" ON "Product"("createdAt");
CREATE INDEX IF NOT EXISTS "Product_isNew_createdAt_idx" ON "Product"("isNew", "createdAt");
CREATE INDEX IF NOT EXISTS "Product_isFeatured_createdAt_idx" ON "Product"("isFeatured", "createdAt");
CREATE INDEX IF NOT EXISTS "Product_isTrending_createdAt_idx" ON "Product"("isTrending", "createdAt");
CREATE INDEX IF NOT EXISTS "Product_isBestSeller_createdAt_idx" ON "Product"("isBestSeller", "createdAt");
CREATE INDEX IF NOT EXISTS "ProductVariant_price_idx" ON "ProductVariant"("price");
CREATE INDEX IF NOT EXISTS "ProductVariantAttribute_attributeId_valueId_idx" ON "ProductVariantAttribute"("attributeId", "valueId");
CREATE INDEX IF NOT EXISTS "Review_productId_createdAt_idx" ON "Review"("productId", "createdAt");
