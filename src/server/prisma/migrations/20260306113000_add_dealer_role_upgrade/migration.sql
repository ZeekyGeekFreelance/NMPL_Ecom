ALTER TYPE "ROLE" ADD VALUE IF NOT EXISTS 'DEALER';

UPDATE "User" u
SET "role" = 'DEALER'::"ROLE"
FROM "DealerProfile" dp
WHERE dp."userId" = u."id"
  AND dp."status" IN ('APPROVED'::"DEALER_STATUS", 'LEGACY'::"DEALER_STATUS", 'SUSPENDED'::"DEALER_STATUS")
  AND u."role" = 'USER'::"ROLE";

UPDATE "User" u
SET "role" = 'USER'::"ROLE"
FROM "DealerProfile" dp
WHERE dp."userId" = u."id"
  AND dp."status" IN ('PENDING'::"DEALER_STATUS", 'REJECTED'::"DEALER_STATUS")
  AND u."role" = 'DEALER'::"ROLE";
