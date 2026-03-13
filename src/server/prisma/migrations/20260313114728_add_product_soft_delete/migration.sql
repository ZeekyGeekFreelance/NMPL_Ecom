/*
  Warnings:

  - A unique constraint covering the columns `[gatewayPaymentId]` on the table `PaymentTransaction` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."PaymentTransaction" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "DealerCreditLedger_orderId_idx" ON "public"."DealerCreditLedger"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_gatewayPaymentId_key" ON "public"."PaymentTransaction"("gatewayPaymentId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_gatewayPaymentId_idx" ON "public"."PaymentTransaction"("gatewayPaymentId");

-- CreateIndex
CREATE INDEX "Product_isDeleted_idx" ON "public"."Product"("isDeleted");
