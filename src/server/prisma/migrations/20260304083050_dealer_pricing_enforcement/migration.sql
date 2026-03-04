/*
  Warnings:

  - The `status` column on the `DealerProfile` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "public"."DEALER_STATUS" AS ENUM ('PENDING', 'APPROVED', 'LEGACY', 'REJECTED', 'SUSPENDED');

-- DropIndex
DROP INDEX "public"."User_isBillingSupervisor_role_idx";

-- AlterTable
ALTER TABLE "public"."DealerPriceMapping" ADD COLUMN     "previousPrice" DOUBLE PRECISION,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."DealerProfile" DROP COLUMN "status",
ADD COLUMN     "status" "public"."DEALER_STATUS" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."DeliveryRate" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."Invoice" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."InvoiceCounter" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."OrderAddressSnapshot" ALTER COLUMN "addressType" DROP DEFAULT,
ALTER COLUMN "deliveryMode" DROP DEFAULT,
ALTER COLUMN "deliveryLabel" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."ProductVariant" ADD COLUMN     "defaultDealerPrice" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "public"."AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "AppSetting_updatedAt_idx" ON "public"."AppSetting"("updatedAt");

-- CreateIndex
CREATE INDEX "DealerProfile_status_idx" ON "public"."DealerProfile"("status");

-- CreateIndex
CREATE INDEX "Product_categoryId_createdAt_idx" ON "public"."Product"("categoryId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_createdAt_idx" ON "public"."ProductVariant"("productId", "createdAt");
