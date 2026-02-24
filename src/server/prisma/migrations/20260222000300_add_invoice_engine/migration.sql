CREATE TABLE IF NOT EXISTS "InvoiceCounter" (
  "year" INTEGER NOT NULL,
  "sequence" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("year")
);

CREATE TABLE IF NOT EXISTS "Invoice" (
  "id" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "customerEmail" TEXT NOT NULL,
  "customerEmailSentAt" TIMESTAMP(3),
  "internalEmailSentAt" TIMESTAMP(3),
  "lastEmailError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Invoice_invoiceNumber_key" UNIQUE ("invoiceNumber"),
  CONSTRAINT "Invoice_orderId_key" UNIQUE ("orderId"),
  CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Invoice_userId_createdAt_idx"
  ON "Invoice"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "Invoice_createdAt_idx"
  ON "Invoice"("createdAt");
