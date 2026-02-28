-- Expand transaction status enum to quotation + reservation workflow states.
ALTER TYPE "TRANSACTION_STATUS" RENAME TO "TRANSACTION_STATUS_OLD";

CREATE TYPE "TRANSACTION_STATUS" AS ENUM (
  'PENDING_VERIFICATION',
  'WAITLISTED',
  'AWAITING_PAYMENT',
  'QUOTATION_REJECTED',
  'QUOTATION_EXPIRED',
  'CONFIRMED'
);

ALTER TABLE "Transaction"
ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Transaction"
ALTER COLUMN "status" TYPE "TRANSACTION_STATUS"
USING (
  CASE
    WHEN "status"::text = 'PLACED' THEN 'PENDING_VERIFICATION'
    WHEN "status"::text = 'REJECTED' THEN 'QUOTATION_REJECTED'
    WHEN "status"::text = 'DELIVERED' THEN 'CONFIRMED'
    ELSE 'CONFIRMED'
  END
)::"TRANSACTION_STATUS";

ALTER TABLE "Transaction"
ALTER COLUMN "status" SET DEFAULT 'PENDING_VERIFICATION';

DROP TYPE "TRANSACTION_STATUS_OLD";

-- Track stock reservations without deducting actual stock pre-payment.
ALTER TABLE "ProductVariant"
ADD COLUMN "reservedStock" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ProductVariant"
ADD CONSTRAINT "ProductVariant_reservedStock_non_negative" CHECK ("reservedStock" >= 0);

ALTER TABLE "ProductVariant"
ADD CONSTRAINT "ProductVariant_reservedStock_lte_stock" CHECK ("reservedStock" <= "stock");

-- Expand order metadata for verification/quotation flow.
ALTER TABLE "Order"
ADD COLUMN "verificationQueuedAt" TIMESTAMP(3),
ADD COLUMN "quotationSentAt" TIMESTAMP(3),
ADD COLUMN "paymentRequestedAt" TIMESTAMP(3),
ADD COLUMN "reservationExpiresAt" TIMESTAMP(3);

UPDATE "Order"
SET "status" = CASE
  WHEN "status" = 'PLACED' THEN 'PENDING_VERIFICATION'
  WHEN "status" = 'REJECTED' THEN 'QUOTATION_REJECTED'
  WHEN "status" = 'DELIVERED' THEN 'CONFIRMED'
  WHEN "status" = 'CONFIRMED' THEN 'CONFIRMED'
  ELSE "status"
END;

ALTER TABLE "Order"
ALTER COLUMN "status" SET DEFAULT 'PENDING_VERIFICATION';

CREATE TYPE "RESERVATION_STATUS" AS ENUM ('ACTIVE', 'RELEASED', 'EXPIRED', 'CONSUMED');

CREATE TABLE "OrderReservation" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" "RESERVATION_STATUS" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "releasedAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrderReservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderReservation_orderId_key" ON "OrderReservation"("orderId");
CREATE INDEX "OrderReservation_status_expiresAt_idx" ON "OrderReservation"("status", "expiresAt");
CREATE INDEX "Order_status_idx" ON "Order"("status");

ALTER TABLE "OrderReservation"
ADD CONSTRAINT "OrderReservation_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
