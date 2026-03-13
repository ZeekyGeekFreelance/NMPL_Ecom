-- Backfill ROLE column now that 'DEALER' is committed to the enum.
-- Must run in a separate migration from the ALTER TYPE above because PostgreSQL
-- does not allow a newly-added enum value to be referenced in the same
-- transaction that created it.

-- Promote approved/legacy/suspended dealer users to DEALER role.
UPDATE "User" u
SET "role" = 'DEALER'::"ROLE"
FROM "DealerProfile" dp
WHERE dp."userId" = u."id"
  AND dp."status" IN ('APPROVED'::"DEALER_STATUS", 'LEGACY'::"DEALER_STATUS", 'SUSPENDED'::"DEALER_STATUS")
  AND u."role" = 'USER'::"ROLE";

-- Demote rejected/pending dealer applicants back to USER role (defensive clean-up).
UPDATE "User" u
SET "role" = 'USER'::"ROLE"
FROM "DealerProfile" dp
WHERE dp."userId" = u."id"
  AND dp."status" IN ('PENDING'::"DEALER_STATUS", 'REJECTED'::"DEALER_STATUS")
  AND u."role" = 'DEALER'::"ROLE";
