-- CreateEnum
CREATE TYPE "ORDER_CUSTOMER_ROLE" AS ENUM ('USER', 'DEALER');

-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "customerRoleSnapshot" "ORDER_CUSTOMER_ROLE" NOT NULL DEFAULT 'USER';

-- Backfill existing orders with dealer role when dealer profile is approved.
UPDATE "Order" o
SET "customerRoleSnapshot" = CASE
  WHEN dp."status" = 'APPROVED' THEN 'DEALER'::"ORDER_CUSTOMER_ROLE"
  ELSE 'USER'::"ORDER_CUSTOMER_ROLE"
END
FROM "User" u
LEFT JOIN "DealerProfile" dp ON dp."userId" = u."id"
WHERE o."userId" = u."id";

-- CreateIndex
CREATE INDEX "Order_customerRoleSnapshot_idx" ON "Order"("customerRoleSnapshot");
