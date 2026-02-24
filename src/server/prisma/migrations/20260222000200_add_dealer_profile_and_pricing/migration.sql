CREATE TABLE IF NOT EXISTS "DealerProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "businessName" TEXT,
  "contactPhone" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "approvedAt" TIMESTAMP(3),
  "approvedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DealerProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DealerProfile_userId_key" UNIQUE ("userId"),
  CONSTRAINT "DealerProfile_status_check" CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED')),
  CONSTRAINT "DealerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "DealerPriceMapping" (
  "id" TEXT NOT NULL,
  "dealerId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "customPrice" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DealerPriceMapping_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DealerPriceMapping_customPrice_check" CHECK ("customPrice" >= 0),
  CONSTRAINT "DealerPriceMapping_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DealerPriceMapping_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DealerPriceMapping_dealerId_variantId_key" UNIQUE ("dealerId", "variantId")
);

CREATE INDEX IF NOT EXISTS "DealerProfile_status_idx"
  ON "DealerProfile"("status");

CREATE INDEX IF NOT EXISTS "DealerPriceMapping_dealerId_idx"
  ON "DealerPriceMapping"("dealerId");

CREATE INDEX IF NOT EXISTS "DealerPriceMapping_variantId_idx"
  ON "DealerPriceMapping"("variantId");
