-- Create enum for immutable quotation history events.
CREATE TYPE "ORDER_QUOTATION_LOG_EVENT" AS ENUM (
  'ORIGINAL_ORDER',
  'ADMIN_QUOTATION',
  'CUSTOMER_ACCEPTED',
  'CUSTOMER_REJECTED',
  'QUOTATION_EXPIRED',
  'PAYMENT_CONFIRMED'
);

-- Append-only quotation price history per order.
CREATE TABLE "OrderQuotationLog" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "event" "ORDER_QUOTATION_LOG_EVENT" NOT NULL,
  "previousTotal" DOUBLE PRECISION,
  "updatedTotal" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "actorUserId" TEXT,
  "actorRole" TEXT,
  "message" TEXT,
  "lineItems" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderQuotationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderQuotationLog_orderId_createdAt_idx"
  ON "OrderQuotationLog"("orderId", "createdAt");

CREATE INDEX "OrderQuotationLog_event_createdAt_idx"
  ON "OrderQuotationLog"("event", "createdAt");

ALTER TABLE "OrderQuotationLog"
ADD CONSTRAINT "OrderQuotationLog_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
