/**
 * Shared DealerRepository
 * ──────────────────────────────────────────────────────────────────────────
 * Single source of truth for all DealerProfile + DealerPriceMapping
 * raw SQL operations. Previously duplicated across:
 *   - modules/auth/auth.repository.ts
 *   - modules/user/user.repository.ts
 *
 * Both modules now import from here. Any bug fixes apply to every consumer.
 */
import prisma from "@/infra/database/database.config";
import { Prisma, ROLE } from "@prisma/client";
import AppError from "@/shared/errors/AppError";
import { clearProtectUserCache } from "@/shared/utils/auth/protectCache";

export type DealerStatus =
  | "PENDING"
  | "APPROVED"
  | "LEGACY"
  | "REJECTED"
  | "SUSPENDED";

export interface DealerProfileRecord {
  id: string;
  userId: string;
  businessName: string | null;
  contactPhone: string | null;
  status: DealerStatus;
  approvedAt: Date | null;
  approvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function isDealerTableMissing(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('relation "DealerProfile" does not exist') ||
      error.message.includes('relation "DealerPriceMapping" does not exist'))
  );
}

function throwDealerMigrationError(): never {
  throw new AppError(
    503,
    "Dealer tables are not available. Run Prisma migrations before using dealer features."
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch a single dealer profile by userId.
 * Returns null if not found or if the table hasn't been migrated yet.
 */
export async function findDealerProfileByUserId(
  userId: string
): Promise<DealerProfileRecord | null> {
  try {
    const rows = await prisma.$queryRaw<DealerProfileRecord[]>(
      Prisma.sql`
        SELECT
          "id",
          "userId",
          "businessName",
          "contactPhone",
          "status",
          "approvedAt",
          "approvedBy",
          "createdAt",
          "updatedAt"
        FROM "DealerProfile"
        WHERE "userId" = ${userId}
        LIMIT 1
      `
    );
    return rows[0] ?? null;
  } catch (error) {
    if (isDealerTableMissing(error)) return null;
    throw error;
  }
}

/**
 * Fetch multiple dealer profiles by userId in a single query.
 * Returns an empty array if not found or if the table hasn't been migrated.
 */
export async function findDealerProfilesByUserIds(
  userIds: string[]
): Promise<DealerProfileRecord[]> {
  if (!userIds.length) return [];
  try {
    return await prisma.$queryRaw<DealerProfileRecord[]>(
      Prisma.sql`
        SELECT
          "id",
          "userId",
          "businessName",
          "contactPhone",
          "status",
          "approvedAt",
          "approvedBy",
          "createdAt",
          "updatedAt"
        FROM "DealerProfile"
        WHERE "userId" IN (${Prisma.join(userIds)})
      `
    );
  } catch (error) {
    if (isDealerTableMissing(error)) return [];
    throw error;
  }
}

/**
 * Upsert a dealer profile.
 * Uses gen_random_uuid() (DB-side) for ID generation — consistent across all callers.
 * ON CONFLICT targets the unique index on "userId".
 */
export async function upsertDealerProfile(data: {
  userId: string;
  businessName?: string | null;
  contactPhone?: string | null;
  status: DealerStatus;
  approvedBy?: string | null;
}): Promise<DealerProfileRecord | null> {
  const now = new Date();
  const approvedAt = data.status === "APPROVED" ? now : null;

  try {
    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "DealerProfile" (
          "id",
          "userId",
          "businessName",
          "contactPhone",
          "status",
          "approvedAt",
          "approvedBy",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          gen_random_uuid(),
          ${data.userId},
          ${data.businessName ?? null},
          ${data.contactPhone ?? null},
          ${data.status}::"DEALER_STATUS",
          ${approvedAt},
          ${data.approvedBy ?? null},
          ${now},
          ${now}
        )
        ON CONFLICT ("userId")
        DO UPDATE SET
          "businessName" = COALESCE(EXCLUDED."businessName", "DealerProfile"."businessName"),
          "contactPhone" = COALESCE(EXCLUDED."contactPhone", "DealerProfile"."contactPhone"),
          "status"       = EXCLUDED."status",
          "approvedAt"   = EXCLUDED."approvedAt",
          "approvedBy"   = EXCLUDED."approvedBy",
          "updatedAt"    = EXCLUDED."updatedAt"
      `
    );
  } catch (error) {
    if (isDealerTableMissing(error)) throwDealerMigrationError();
    throw error;
  }

  return findDealerProfileByUserId(data.userId);
}

/**
 * Atomically update dealer status AND the linked User.role + tokenVersion
 * in a single CTE — prevents the two tables going out of sync.
 */
export async function updateDealerStatus(
  userId: string,
  status: DealerStatus,
  approvedBy?: string
): Promise<DealerProfileRecord | null> {
  const now = new Date();
  const approvedAt = status === "APPROVED" ? now : null;
  const nextRole =
    status === "APPROVED" || status === "LEGACY" || status === "SUSPENDED"
      ? ROLE.DEALER
      : ROLE.USER;

  try {
    const rows = await prisma.$queryRaw<DealerProfileRecord[]>(
      Prisma.sql`
        WITH updated_profile AS (
          UPDATE "DealerProfile"
          SET
            "status"     = ${status}::"DEALER_STATUS",
            "approvedAt" = ${approvedAt},
            "approvedBy" = ${
              status === "APPROVED" || status === "LEGACY"
                ? approvedBy ?? null
                : null
            },
            "updatedAt"  = ${now}
          WHERE "userId" = ${userId}
          RETURNING
            "id", "userId", "businessName", "contactPhone",
            "status", "approvedAt", "approvedBy", "createdAt", "updatedAt"
        ),
        updated_user AS (
          UPDATE "User"
          SET
            "role"         = ${nextRole}::"ROLE",
            "tokenVersion" = "User"."tokenVersion" + 1,
            "updatedAt"    = ${now}
          WHERE "id" = ${userId}
            AND EXISTS (SELECT 1 FROM updated_profile)
          RETURNING "id"
        )
        SELECT
          up."id", up."userId", up."businessName", up."contactPhone",
          up."status", up."approvedAt", up."approvedBy",
          up."createdAt", up."updatedAt"
        FROM updated_profile up
      `
    );
    const result = rows[0] ?? null;

    // Invalidate the protect middleware cache: the CTE above increments
    // tokenVersion, so any cached user record for this userId is now stale.
    if (result) {
      await clearProtectUserCache(userId);
    }

    return result;
  } catch (error) {
    if (isDealerTableMissing(error)) throwDealerMigrationError();
    throw error;
  }
}
