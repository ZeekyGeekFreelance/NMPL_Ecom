/**
 * Shared DealerRepository
 * ──────────────────────────────────────────────────────────────────────────
 * Single source of truth for all DealerProfile + DealerPriceMapping
 * raw SQL operations. Consumed by:
 *   - modules/auth/auth.repository.ts
 *   - modules/user/user.repository.ts
 *
 * Phase 2 additions: payLaterEnabled, creditTermDays fields.
 * Phase 3 additions: legacy dealer creation support in upsertDealerProfile;
 *                    payLaterEnabled mirrored in updateDealerStatus.
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
  /** True only for LEGACY dealers.  All other statuses have false. */
  payLaterEnabled: boolean;
  /** NET payment term in days (default 30).  Meaningful only when payLaterEnabled = true. */
  creditTermDays: number;
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
          "payLaterEnabled",
          "creditTermDays",
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
          "payLaterEnabled",
          "creditTermDays",
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
 *
 * ON CONFLICT targets the unique index on "userId".
 * payLaterEnabled / creditTermDays: updated via COALESCE so that callers
 * that don't provide these fields (e.g. auth registration) leave them untouched.
 *
 * approvedAt is set when status is APPROVED or LEGACY (both represent admin approval).
 */
export async function upsertDealerProfile(data: {
  userId: string;
  businessName?: string | null;
  contactPhone?: string | null;
  status: DealerStatus;
  approvedBy?: string | null;
  payLaterEnabled?: boolean | null;
  creditTermDays?: number | null;
}): Promise<DealerProfileRecord | null> {
  const now = new Date();
  // approvedAt is set for both APPROVED and LEGACY — both are admin-approved states.
  const approvedAt =
    data.status === "APPROVED" || data.status === "LEGACY" ? now : null;

  // Resolve concrete values for the new pay-later columns.
  // null means "don't override" — COALESCE in ON CONFLICT handles this.
  const payLaterEnabled = data.payLaterEnabled ?? null;
  const creditTermDays = data.creditTermDays ?? null;

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
          "payLaterEnabled",
          "creditTermDays",
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
          ${payLaterEnabled ?? false},
          ${creditTermDays ?? 30},
          ${now},
          ${now}
        )
        ON CONFLICT ("userId")
        DO UPDATE SET
          "businessName"    = COALESCE(EXCLUDED."businessName",    "DealerProfile"."businessName"),
          "contactPhone"    = COALESCE(EXCLUDED."contactPhone",    "DealerProfile"."contactPhone"),
          "status"          = EXCLUDED."status",
          "approvedAt"      = EXCLUDED."approvedAt",
          "approvedBy"      = EXCLUDED."approvedBy",
          "payLaterEnabled" = COALESCE(${payLaterEnabled}, "DealerProfile"."payLaterEnabled"),
          "creditTermDays"  = COALESCE(${creditTermDays},  "DealerProfile"."creditTermDays"),
          "updatedAt"       = EXCLUDED."updatedAt"
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
 *
 * payLaterEnabled is automatically mirrored:
 *   LEGACY  → payLaterEnabled = TRUE
 *   any other status → payLaterEnabled = FALSE
 *
 * This ensures that if an admin demotes a legacy dealer back to APPROVED or
 * SUSPENDED, they lose pay-later access immediately without a separate action.
 */
export async function updateDealerStatus(
  userId: string,
  status: DealerStatus,
  approvedBy?: string
): Promise<DealerProfileRecord | null> {
  const now = new Date();
  const approvedAt =
    status === "APPROVED" || status === "LEGACY" ? now : null;
  const nextRole =
    status === "APPROVED" || status === "LEGACY" || status === "SUSPENDED"
      ? ROLE.DEALER
      : ROLE.USER;
  // Mirror payLaterEnabled: only LEGACY status enables pay-later.
  const payLaterEnabled = status === "LEGACY";

  try {
    const rows = await prisma.$queryRaw<DealerProfileRecord[]>(
      Prisma.sql`
        WITH updated_profile AS (
          UPDATE "DealerProfile"
          SET
            "status"          = ${status}::"DEALER_STATUS",
            "approvedAt"      = ${approvedAt},
            "approvedBy"      = ${
              status === "APPROVED" || status === "LEGACY"
                ? approvedBy ?? null
                : null
            },
            "payLaterEnabled" = ${payLaterEnabled},
            "updatedAt"       = ${now}
          WHERE "userId" = ${userId}
          RETURNING
            "id", "userId", "businessName", "contactPhone",
            "status", "approvedAt", "approvedBy",
            "payLaterEnabled", "creditTermDays",
            "createdAt", "updatedAt"
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
          up."payLaterEnabled", up."creditTermDays",
          up."createdAt", up."updatedAt"
        FROM updated_profile up
      `
    );
    const result = rows[0] ?? null;

    // Invalidate the protect middleware cache.
    if (result) {
      await clearProtectUserCache(userId);
    }

    return result;
  } catch (error) {
    if (isDealerTableMissing(error)) throwDealerMigrationError();
    throw error;
  }
}
