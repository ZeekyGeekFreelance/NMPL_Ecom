-- Add optional phone column for backward-compatible user contact storage.
ALTER TABLE "User"
ADD COLUMN "phone" TEXT;

CREATE INDEX "User_phone_idx" ON "User"("phone");
