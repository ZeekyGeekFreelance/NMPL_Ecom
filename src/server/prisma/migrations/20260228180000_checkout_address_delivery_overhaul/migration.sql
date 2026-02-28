-- Checkout Architecture Overhaul
-- - Multi-address management on user accounts
-- - Immutable order address snapshot
-- - Delivery mode + delivery charge snapshot fields on orders
-- - Delivery rate mapping table

DO $$
BEGIN
  CREATE TYPE "ADDRESS_TYPE" AS ENUM ('HOME', 'OFFICE', 'WAREHOUSE', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "DELIVERY_MODE" AS ENUM ('PICKUP', 'DELIVERY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "subtotalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "deliveryCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "deliveryMode" "DELIVERY_MODE" NOT NULL DEFAULT 'DELIVERY';

UPDATE "Order"
SET
  "subtotalAmount" = COALESCE("amount", 0),
  "deliveryCharge" = COALESCE("deliveryCharge", 0)
WHERE "subtotalAmount" = 0;

ALTER TABLE "Address"
  ADD COLUMN IF NOT EXISTS "type" "ADDRESS_TYPE" NOT NULL DEFAULT 'HOME',
  ADD COLUMN IF NOT EXISTS "fullName" TEXT,
  ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "line1" TEXT,
  ADD COLUMN IF NOT EXISTS "line2" TEXT,
  ADD COLUMN IF NOT EXISTS "landmark" TEXT,
  ADD COLUMN IF NOT EXISTS "pincode" TEXT,
  ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE "Address" a
SET
  "fullName" = COALESCE(a."fullName", u."name", 'Unknown'),
  "phoneNumber" = COALESCE(a."phoneNumber", u."phone", '0000000000'),
  "line1" = COALESCE(a."line1", a."street", 'N/A'),
  "pincode" = COALESCE(a."pincode", a."zip", '000000')
FROM "User" u
WHERE a."userId" = u."id";

UPDATE "Address"
SET
  "fullName" = COALESCE("fullName", 'Unknown'),
  "phoneNumber" = COALESCE("phoneNumber", '0000000000'),
  "line1" = COALESCE("line1", 'N/A'),
  "pincode" = COALESCE("pincode", '000000');

ALTER TABLE "Address"
  ALTER COLUMN "fullName" SET NOT NULL,
  ALTER COLUMN "phoneNumber" SET NOT NULL,
  ALTER COLUMN "line1" SET NOT NULL,
  ALTER COLUMN "pincode" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "OrderAddressSnapshot" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "sourceAddressId" TEXT,
  "addressType" "ADDRESS_TYPE" NOT NULL DEFAULT 'HOME',
  "fullName" TEXT NOT NULL,
  "phoneNumber" TEXT NOT NULL,
  "line1" TEXT NOT NULL,
  "line2" TEXT,
  "landmark" TEXT,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "pincode" TEXT NOT NULL,
  "deliveryMode" "DELIVERY_MODE" NOT NULL DEFAULT 'DELIVERY',
  "deliveryCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "deliveryLabel" TEXT NOT NULL DEFAULT 'Delivery',
  "serviceArea" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderAddressSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrderAddressSnapshot_orderId_key" ON "OrderAddressSnapshot"("orderId");
CREATE INDEX IF NOT EXISTS "OrderAddressSnapshot_pincode_idx" ON "OrderAddressSnapshot"("pincode");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'OrderAddressSnapshot_orderId_fkey'
  ) THEN
    ALTER TABLE "OrderAddressSnapshot"
      ADD CONSTRAINT "OrderAddressSnapshot_orderId_fkey"
      FOREIGN KEY ("orderId")
      REFERENCES "Order"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END
$$;

INSERT INTO "OrderAddressSnapshot" (
  "id",
  "orderId",
  "sourceAddressId",
  "addressType",
  "fullName",
  "phoneNumber",
  "line1",
  "line2",
  "landmark",
  "city",
  "state",
  "country",
  "pincode",
  "deliveryMode",
  "deliveryCharge",
  "deliveryLabel",
  "serviceArea",
  "createdAt",
  "updatedAt"
)
SELECT
  a."orderId",
  a."orderId",
  a."id",
  COALESCE(a."type", 'HOME')::"ADDRESS_TYPE",
  COALESCE(a."fullName", u."name", 'Unknown'),
  COALESCE(a."phoneNumber", u."phone", '0000000000'),
  COALESCE(a."line1", a."street", 'N/A'),
  a."line2",
  a."landmark",
  a."city",
  a."state",
  a."country",
  COALESCE(a."pincode", a."zip", '000000'),
  COALESCE(o."deliveryMode", 'DELIVERY')::"DELIVERY_MODE",
  COALESCE(o."deliveryCharge", 0),
  CASE
    WHEN COALESCE(o."deliveryMode", 'DELIVERY') = 'PICKUP' THEN 'In-Store Pickup'
    ELSE 'Delivery'
  END,
  COALESCE(a."city", ''),
  NOW(),
  NOW()
FROM "Address" a
JOIN "Order" o ON o."id" = a."orderId"
LEFT JOIN "User" u ON u."id" = a."userId"
WHERE a."orderId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "OrderAddressSnapshot" s
    WHERE s."orderId" = a."orderId"
  );

ALTER TABLE "Address"
  DROP COLUMN IF EXISTS "orderId",
  DROP COLUMN IF EXISTS "street",
  DROP COLUMN IF EXISTS "zip";

CREATE INDEX IF NOT EXISTS "Address_userId_isDefault_idx" ON "Address"("userId", "isDefault");

CREATE TABLE IF NOT EXISTS "DeliveryRate" (
  "id" TEXT NOT NULL,
  "pincode" TEXT NOT NULL,
  "city" TEXT,
  "state" TEXT,
  "charge" DOUBLE PRECISION NOT NULL,
  "isServiceable" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryRate_pincode_key" ON "DeliveryRate"("pincode");
CREATE INDEX IF NOT EXISTS "DeliveryRate_isServiceable_idx" ON "DeliveryRate"("isServiceable");
