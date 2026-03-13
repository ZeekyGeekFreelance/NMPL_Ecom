-- CreateTable
CREATE TABLE "public"."DeliveryStateRate" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "charge" DOUBLE PRECISION NOT NULL,
    "isServiceable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryStateRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryStateRate_state_key" ON "public"."DeliveryStateRate"("state");

-- CreateIndex
CREATE INDEX "DeliveryStateRate_isServiceable_idx" ON "public"."DeliveryStateRate"("isServiceable");
