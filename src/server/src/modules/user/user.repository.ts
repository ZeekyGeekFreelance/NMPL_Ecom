import prisma from "@/infra/database/database.config";
import { Prisma, ROLE } from "@prisma/client";
import { passwordUtils } from "@/shared/utils/authUtils";
import AppError from "@/shared/errors/AppError";
import { clearProtectUserCache } from "@/shared/utils/auth/protectCache";
import {
  findDealerProfileByUserId as sharedFindDealerProfileByUserId,
  findDealerProfilesByUserIds as sharedFindDealerProfilesByUserIds,
  upsertDealerProfile as sharedUpsertDealerProfile,
  updateDealerStatus as sharedUpdateDealerStatus,
} from "@/shared/repositories/dealer.repository";

// Import into local scope (required for use inside this file)
import type { DealerStatus, DealerProfileRecord as DealerProfile } from "@/shared/repositories/dealer.repository";
// Re-export so existing imports from user.repository continue to work
export type { DealerStatus, DealerProfileRecord as DealerProfile } from "@/shared/repositories/dealer.repository";

export interface DealerPriceInput {
  variantId: string;
  customPrice: number;
}

export class UserRepository {
  // ── Internal helpers (retained for DealerPriceMapping queries) ──────────
  private isDealerTableMissing(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return (
      error.message.includes('relation "DealerProfile" does not exist') ||
      error.message.includes('relation "DealerPriceMapping" does not exist')
    );
  }

  private throwDealerMigrationError(): never {
    throw new AppError(
      503,
      "Dealer tables are not available. Run Prisma migrations before using dealer features."
    );
  }

  // ── Dealer profile methods — delegate to shared repository ──────────────
  private async findDealerProfilesByUserIds(
    userIds: string[]
  ): Promise<DealerProfile[]> {
    return sharedFindDealerProfilesByUserIds(userIds);
  }

  async findAllUsers(options?: { skip?: number; take?: number }) {
    const skip = options?.skip ?? 0;
    const take = Math.min(options?.take ?? 50, 200);
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        role: true,
        isBillingSupervisor: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const dealerProfiles = await this.findDealerProfilesByUserIds(
      users.map((user) => user.id)
    );
    const dealerProfilesByUserId = new Map(
      dealerProfiles.map((profile) => [profile.userId, profile])
    );

    return users.map((user) => ({
      ...user,
      dealerProfile: dealerProfilesByUserId.get(user.id) ?? null,
    }));
  }

  async findUserById(id: string | undefined) {
    if (!id) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        role: true,
        isBillingSupervisor: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return null;
    }

    const dealerProfile = await this.findDealerProfileByUserId(user.id);

    return {
      ...user,
      dealerProfile,
    };
  }

  async findUserByEmail(email: string) {
    return await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        role: true,
        isBillingSupervisor: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateUser(
    id: string,
    data: {
      name?: string;
      email?: string;
      phone?: string | null;
      password?: string;
      avatar?: string | null;
      role?: ROLE;
      isBillingSupervisor?: boolean;
      mustChangePassword?: boolean;
      resetPasswordToken?: string | null;
      resetPasswordTokenExpiresAt?: Date | null;
    }
  ) {
    return await prisma.user.update({ where: { id }, data });
  }

  async updateUserPassword(userId: string, password: string) {
    const hashedPassword = await passwordUtils.hashPassword(password);

    const result = await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordTokenExpiresAt: null,
        tokenVersion: { increment: 1 },
      },
    });

    await clearProtectUserCache(userId);
    return result;
  }

  async incrementUserTokenVersion(userId: string) {
    const result = await prisma.user.update({
      where: { id: userId },
      data: {
        tokenVersion: { increment: 1 },
      },
      select: {
        id: true,
      },
    });

    await clearProtectUserCache(userId);
    return result;
  }

  async deleteUser(id: string) {
    return await prisma.user.delete({ where: { id } });
  }

  async countUsersByRole(role: string) {
    return await prisma.user.count({
      where: { role: role as any },
    });
  }

  async countValidVariants(variantIds: string[]) {
    if (!variantIds.length) {
      return 0;
    }

    return prisma.productVariant.count({
      where: {
        id: {
          in: variantIds,
        },
      },
    });
  }

  async findVariantRetailSnapshot(variantIds: string[]) {
    if (!variantIds.length) {
      return [];
    }

    return prisma.productVariant.findMany({
      where: {
        id: {
          in: variantIds,
        },
      },
      select: {
        id: true,
        sku: true,
        price: true,
      },
    });
  }

  async createUser(data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    role: string;
    isBillingSupervisor?: boolean;
    /** When true, the user is forced to change their password on first login. */
    mustChangePassword?: boolean;
  }) {
    // Hash the password before storing
    const hashedPassword = await passwordUtils.hashPassword(data.password);

    return await prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
        role: data.role as any,
        isBillingSupervisor: data.isBillingSupervisor ?? false,
        mustChangePassword: data.mustChangePassword ?? false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isBillingSupervisor: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findDealerProfileByUserId(userId: string): Promise<DealerProfile | null> {
    return sharedFindDealerProfileByUserId(userId);
  }

  /**
   * Upsert a dealer profile.
   *
   * payLaterEnabled / creditTermDays are Phase 2 fields used exclusively when
   * creating or upgrading a LEGACY dealer.  The shared repository handles the
   * ON CONFLICT COALESCE logic so callers that omit these fields leave the
   * existing DB values untouched.
   */
  async upsertDealerProfile(data: {
    userId: string;
    businessName?: string | null;
    contactPhone?: string | null;
    status: DealerStatus;
    approvedBy?: string | null;
    /**
     * When true, the dealer receives pay-later access (LEGACY dealers only).
     * Passed through to the shared repository ON CONFLICT upsert.
     */
    payLaterEnabled?: boolean | null;
    /**
     * NET payment term in calendar days (e.g. 30 = NET 30).
     * Defaults to 30 in the DB when not provided.
     */
    creditTermDays?: number | null;
  }): Promise<DealerProfile | null> {
    return sharedUpsertDealerProfile(data);
  }

  async getDealers(status?: DealerStatus) {
    const statusFilter = status
      ? Prisma.sql`WHERE dp."status" = ${status}::"DEALER_STATUS"`
      : Prisma.empty;

    try {
      return prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          email: string;
          phone: string | null;
          role: ROLE;
          avatar: string | null;
          createdAt: Date;
          updatedAt: Date;
          dealerProfileId: string;
          businessName: string | null;
          contactPhone: string | null;
          status: DealerStatus;
          approvedAt: Date | null;
          approvedBy: string | null;
          dealerCreatedAt: Date;
          dealerUpdatedAt: Date;
        }>
      >(
        Prisma.sql`
          SELECT
            u."id",
            u."name",
            u."email",
            u."phone",
            u."role",
            u."avatar",
            u."createdAt",
            u."updatedAt",
            dp."id" AS "dealerProfileId",
            dp."businessName",
            dp."contactPhone",
            dp."status",
            dp."approvedAt",
            dp."approvedBy",
            dp."createdAt" AS "dealerCreatedAt",
            dp."updatedAt" AS "dealerUpdatedAt"
          FROM "User" u
          INNER JOIN "DealerProfile" dp ON dp."userId" = u."id"
          ${statusFilter}
          ORDER BY dp."updatedAt" DESC
        `
      );
    } catch (error) {
      if (this.isDealerTableMissing(error)) {
        return [];
      }
      throw error;
    }
  }

  async updateDealerStatus(
    userId: string,
    status: DealerStatus,
    approvedBy?: string
  ): Promise<DealerProfile | null> {
    return sharedUpdateDealerStatus(userId, status, approvedBy);
  }

  async setDealerPrices(dealerId: string, prices: DealerPriceInput[]) {
    try {
      await prisma.$transaction(async (tx) => {
        if (!prices.length) {
          // Wipe all mappings for this dealer when the price list is cleared.
          await tx.$executeRaw(
            Prisma.sql`DELETE FROM "DealerPriceMapping" WHERE "dealerId" = ${dealerId}`
          );
          return;
        }

        const now = new Date();
        const incomingVariantIds = prices.map((p) => p.variantId);

        // 1. Remove stale mappings that are no longer in the incoming set (single DELETE).
        await tx.$executeRaw(
          Prisma.sql`
            DELETE FROM "DealerPriceMapping"
            WHERE "dealerId" = ${dealerId}
              AND "variantId" NOT IN (${Prisma.join(incomingVariantIds)})
          `
        );

        // 2. Upsert all prices in a single batched statement.
        //    ON CONFLICT hits the composite unique index (dealerId, variantId) — O(1) per row.
        //    previousPrice is set to the existing customPrice on update, preserved on insert.
        //    NOTE: id column has no DEFAULT in the DB — must supply gen_random_uuid() explicitly.
        const valuesSql = prices.map(
          (p) =>
            Prisma.sql`(gen_random_uuid(), ${dealerId}, ${p.variantId}, ${p.customPrice}, ${now}, ${now})`
        );

        await tx.$executeRaw(
          Prisma.sql`
            INSERT INTO "DealerPriceMapping" ("id", "dealerId", "variantId", "customPrice", "createdAt", "updatedAt")
            VALUES ${Prisma.join(valuesSql)}
            ON CONFLICT ("dealerId", "variantId")
            DO UPDATE SET
              "previousPrice" = "DealerPriceMapping"."customPrice",
              "customPrice"   = EXCLUDED."customPrice",
              "updatedAt"     = EXCLUDED."updatedAt"
          `
        );
      });
    } catch (error) {
      if (this.isDealerTableMissing(error)) {
        this.throwDealerMigrationError();
      }
      throw error;
    }

    return this.getDealerPrices(dealerId);
  }

  async getDealerPrices(dealerId: string) {
    try {
      return await prisma.$queryRaw<
        Array<{
          variantId: string;
          customPrice: number;
          previousPrice: number | null;
          basePrice: number;          // pv.price — the retail base price
          defaultDealerPrice: number | null; // pv.defaultDealerPrice — platform dealer price
          sku: string;
          productName: string;
          lastUpdated: Date;
        }>
      >(
        Prisma.sql`
          SELECT
            m."variantId",
            m."customPrice",
            m."previousPrice",
            pv."price"               AS "basePrice",
            pv."defaultDealerPrice",
            pv."sku",
            p."name"                 AS "productName",
            m."updatedAt"            AS "lastUpdated"
          FROM "DealerPriceMapping" m
          INNER JOIN "ProductVariant" pv ON pv."id" = m."variantId"
          INNER JOIN "Product" p ON p."id" = pv."productId"
          WHERE m."dealerId" = ${dealerId}
          ORDER BY p."name" ASC, pv."sku" ASC
        `
      );
    } catch (error) {
      if (this.isDealerTableMissing(error)) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Resolves effective dealer prices for a set of variants in a single query.
   * Resolution order: customPrice (DealerPriceMapping) → defaultDealerPrice (ProductVariant).
   * Variants with neither mapping nor defaultDealerPrice are excluded from the map.
   */
  async getDealerPriceMap(
    dealerId: string,
    variantIds: string[]
  ): Promise<Map<string, number>> {
    if (!variantIds.length) {
      return new Map();
    }

    try {
      const rows = await prisma.$queryRaw<
        Array<{ variantId: string; resolvedPrice: number }>
      >(
        Prisma.sql`
          SELECT
            pv."id"                                              AS "variantId",
            COALESCE(m."customPrice", pv."defaultDealerPrice")   AS "resolvedPrice"
          FROM "ProductVariant" pv
          LEFT JOIN "DealerPriceMapping" m
            ON m."variantId" = pv."id"
           AND m."dealerId"  = ${dealerId}
          WHERE pv."id" IN (${Prisma.join(variantIds)})
            AND COALESCE(m."customPrice", pv."defaultDealerPrice") IS NOT NULL
        `
      );

      return new Map(rows.map((row) => [row.variantId, Number(row.resolvedPrice)]));
    } catch (error) {
      if (this.isDealerTableMissing(error)) {
        return new Map();
      }
      throw error;
    }
  }
}
