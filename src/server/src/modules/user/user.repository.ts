import prisma from "@/infra/database/database.config";
import { Prisma, ROLE } from "@prisma/client";
import { passwordUtils } from "@/shared/utils/authUtils";
import AppError from "@/shared/errors/AppError";

export type DealerStatus = "PENDING" | "APPROVED" | "LEGACY" | "REJECTED" | "SUSPENDED";

export interface DealerProfile {
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

export interface DealerPriceInput {
  variantId: string;
  customPrice: number;
}

export class UserRepository {
  private isDealerTableMissing(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

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

  private async findDealerProfilesByUserIds(
    userIds: string[]
  ): Promise<DealerProfile[]> {
    if (!userIds.length) {
      return [];
    }

    try {
      return await prisma.$queryRaw<DealerProfile[]>(
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
      if (this.isDealerTableMissing(error)) {
        return [];
      }
      throw error;
    }
  }

  async findAllUsers() {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
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
    data: Partial<{
      name?: string;
      email?: string;
      phone?: string | null;
      password?: string;
      avatar?: string;
      role?: ROLE;
      isBillingSupervisor?: boolean;
      emailVerified?: boolean;
      emailVerificationToken?: string | null;
      emailVerificationTokenExpiresAt?: Date | null;
      resetPasswordToken?: string | null;
      resetPasswordTokenExpiresAt?: Date | null;
    }>
  ) {
    return await prisma.user.update({ where: { id }, data });
  }

  async updateUserPassword(userId: string, password: string) {
    const hashedPassword = await passwordUtils.hashPassword(password);

    return prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordTokenExpiresAt: null,
        tokenVersion: { increment: 1 },
      },
    });
  }

  async incrementUserTokenVersion(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        tokenVersion: { increment: 1 },
      },
      select: {
        id: true,
      },
    });
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
  }) {
    // Hash the password before storing
    const hashedPassword = await passwordUtils.hashPassword(data.password);

    return await prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
        role: data.role as any,
        isBillingSupervisor: data.isBillingSupervisor ?? false,
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
    try {
      const rows = await prisma.$queryRaw<DealerProfile[]>(
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
      if (this.isDealerTableMissing(error)) {
        return null;
      }
      throw error;
    }
  }

  async upsertDealerProfile(data: {
    userId: string;
    businessName?: string | null;
    contactPhone?: string | null;
    status: DealerStatus;
    approvedBy?: string | null;
  }): Promise<DealerProfile | null> {
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
      if (this.isDealerTableMissing(error)) {
        this.throwDealerMigrationError();
      }
      throw error;
    }

    return this.findDealerProfileByUserId(data.userId);
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
    const now = new Date();
    const approvedAt = status === "APPROVED" ? now : null;
    const nextRole =
      status === "APPROVED" || status === "LEGACY" || status === "SUSPENDED"
        ? ROLE.DEALER
        : ROLE.USER;

    try {
      const rows = await prisma.$queryRaw<DealerProfile[]>(
        Prisma.sql`
          WITH updated_profile AS (
            UPDATE "DealerProfile"
            SET
              "status"     = ${status}::"DEALER_STATUS",
              "approvedAt" = ${approvedAt},
              "approvedBy" = ${(status === "APPROVED" || status === "LEGACY") ? approvedBy ?? null : null},
              "updatedAt"  = ${now}
            WHERE "userId" = ${userId}
            RETURNING
              "id",
              "userId",
              "businessName",
              "contactPhone",
              "status",
              "approvedAt",
              "approvedBy",
              "createdAt",
              "updatedAt"
          ),
          updated_user AS (
            UPDATE "User"
            SET
              "role" = ${nextRole}::"ROLE",
              "tokenVersion" = "User"."tokenVersion" + 1,
              "updatedAt" = ${now}
            WHERE "id" = ${userId}
              AND EXISTS (SELECT 1 FROM updated_profile)
            RETURNING "id"
          )
          SELECT
            up."id",
            up."userId",
            up."businessName",
            up."contactPhone",
            up."status",
            up."approvedAt",
            up."approvedBy",
            up."createdAt",
            up."updatedAt"
          FROM updated_profile up
        `
      );

      return rows[0] ?? null;
    } catch (error) {
      if (this.isDealerTableMissing(error)) {
        this.throwDealerMigrationError();
      }
      throw error;
    }
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
