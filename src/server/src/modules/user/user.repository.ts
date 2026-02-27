import prisma from "@/infra/database/database.config";
import { Prisma, ROLE } from "@prisma/client";
import { passwordUtils } from "@/shared/utils/authUtils";
import AppError from "@/shared/errors/AppError";
import crypto from "crypto";

export type DealerStatus = "PENDING" | "APPROVED" | "REJECTED";

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
      password?: string;
      avatar?: string;
      role?: ROLE;
      emailVerified?: boolean;
      emailVerificationToken?: string | null;
      emailVerificationTokenExpiresAt?: Date | null;
      resetPasswordToken?: string | null;
      resetPasswordTokenExpiresAt?: Date | null;
    }>
  ) {
    return await prisma.user.update({ where: { id }, data });
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

  async createUser(data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    role: string;
  }) {
    // Hash the password before storing
    const hashedPassword = await passwordUtils.hashPassword(data.password);

    return await prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
        role: data.role as any,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatar: true,
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
            ${crypto.randomUUID()},
            ${data.userId},
            ${data.businessName ?? null},
            ${data.contactPhone ?? null},
            ${data.status},
            ${approvedAt},
            ${data.approvedBy ?? null},
            ${now},
            ${now}
          )
          ON CONFLICT ("userId")
          DO UPDATE SET
            "businessName" = COALESCE(EXCLUDED."businessName", "DealerProfile"."businessName"),
            "contactPhone" = COALESCE(EXCLUDED."contactPhone", "DealerProfile"."contactPhone"),
            "status" = EXCLUDED."status",
            "approvedAt" = EXCLUDED."approvedAt",
            "approvedBy" = EXCLUDED."approvedBy",
            "updatedAt" = EXCLUDED."updatedAt"
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
      ? Prisma.sql`WHERE dp."status" = ${status}`
      : Prisma.empty;

    try {
      return prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          email: string;
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

    try {
      await prisma.$executeRaw(
        Prisma.sql`
          UPDATE "DealerProfile"
          SET
            "status" = ${status},
            "approvedAt" = ${approvedAt},
            "approvedBy" = ${status === "APPROVED" ? approvedBy ?? null : null},
            "updatedAt" = ${now}
          WHERE "userId" = ${userId}
        `
      );
    } catch (error) {
      if (this.isDealerTableMissing(error)) {
        this.throwDealerMigrationError();
      }
      throw error;
    }

    return this.findDealerProfileByUserId(userId);
  }

  async setDealerPrices(dealerId: string, prices: DealerPriceInput[]) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw(
          Prisma.sql`DELETE FROM "DealerPriceMapping" WHERE "dealerId" = ${dealerId}`
        );

        if (!prices.length) {
          return;
        }

        const now = new Date();
        for (const price of prices) {
          await tx.$executeRaw(
            Prisma.sql`
              INSERT INTO "DealerPriceMapping" (
                "id",
                "dealerId",
                "variantId",
                "customPrice",
                "createdAt",
                "updatedAt"
              )
              VALUES (
                ${crypto.randomUUID()},
                ${dealerId},
                ${price.variantId},
                ${price.customPrice},
                ${now},
                ${now}
              )
            `
          );
        }
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
          sku: string;
          productName: string;
        }>
      >(
        Prisma.sql`
          SELECT
            m."variantId",
            m."customPrice",
            pv."sku",
            p."name" AS "productName"
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

  async getDealerPriceMap(
    dealerId: string,
    variantIds: string[]
  ): Promise<Map<string, number>> {
    if (!variantIds.length) {
      return new Map();
    }

    try {
      const prices = await prisma.$queryRaw<
        Array<{ variantId: string; customPrice: number }>
      >(
        Prisma.sql`
          SELECT
            "variantId",
            "customPrice"
          FROM "DealerPriceMapping"
          WHERE "dealerId" = ${dealerId}
            AND "variantId" IN (${Prisma.join(variantIds)})
        `
      );

      return new Map(prices.map((price) => [price.variantId, price.customPrice]));
    } catch (error) {
      if (this.isDealerTableMissing(error)) {
        return new Map();
      }
      throw error;
    }
  }
}
