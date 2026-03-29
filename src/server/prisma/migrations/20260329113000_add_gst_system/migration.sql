CREATE TABLE "Gst" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gst_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Gst_rate_key" ON "Gst"("rate");
CREATE INDEX "Gst_isActive_rate_idx" ON "Gst"("isActive", "rate");

ALTER TABLE "Product" ADD COLUMN "gstId" TEXT;
CREATE INDEX "Product_gstId_idx" ON "Product"("gstId");

ALTER TABLE "OrderItem"
    ADD COLUMN "gstRateAtPurchase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN "productId" TEXT,
    ADD COLUMN "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN "total" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "OrderItem" AS oi
SET
    "productId" = pv."productId",
    "taxAmount" = 0,
    "total" = ROUND((oi."price" * oi."quantity")::numeric, 2)::double precision
FROM "ProductVariant" AS pv
WHERE oi."variantId" = pv."id";

ALTER TABLE "OrderItem" ALTER COLUMN "productId" SET NOT NULL;

CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

ALTER TABLE "Product"
    ADD CONSTRAINT "Product_gstId_fkey"
    FOREIGN KEY ("gstId") REFERENCES "Gst"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderItem"
    ADD CONSTRAINT "OrderItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
