ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "isBillingSupervisor" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "User_isBillingSupervisor_role_idx"
  ON "User"("isBillingSupervisor", "role");
