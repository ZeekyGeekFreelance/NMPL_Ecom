import prisma from "@/infra/database/database.config";
import { Prisma, ROLE } from "@prisma/client";
import crypto from "crypto";
import AppError from "@/shared/errors/AppError";
import { passwordUtils } from "@/shared/utils/authUtils";

export type DealerStatus = "PENDING" | "APPROVED" | "REJECTED";

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

export class AuthRepository {
  private isDealerTableMissing(error: unknown): boolean {
    return (
      error instanceof Error &&
      error.message.includes('relation "DealerProfile" does not exist')
    );
  }

  async findUserByEmail(email: string) {
    return prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
    });
  }

  async findUserByEmailWithPassword(email: string) {
    return prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        password: true,
        role: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
      },
    });
  }

  async findUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatar: true,
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

  async createUser(data: {
    email: string;
    phone: string;
    name: string;
    password: string;
    role: ROLE;
  }) {
    const hashedPassword = await passwordUtils.hashPassword(data.password);

    return prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
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

  async findDealerProfileByUserId(
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
  }) {
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
        throw new AppError(
          503,
          "Dealer tables are not available. Run Prisma migrations before dealer registration."
        );
      }
      throw error;
    }

    return this.findDealerProfileByUserId(data.userId);
  }

  async updateUserEmailVerification(
    userId: string,
    data: {
      emailVerificationToken: string | null;
      emailVerificationTokenExpiresAt: Date | null;
      emailVerified?: boolean;
    }
  ) {
    return prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  async updateUserPasswordReset(
    email: string,
    data: {
      resetPasswordToken?: string | null;
      resetPasswordTokenExpiresAt?: Date | null;
      password?: string;
    }
  ) {
    const nextData = { ...data };
    if (typeof nextData.password === "string") {
      nextData.password = await passwordUtils.hashPassword(nextData.password);
    }

    const user = await this.findUserByEmail(email);
    if (!user) {
      return null;
    }

    return prisma.user.update({
      where: { id: user.id },
      data: nextData,
    });
  }

  async findUserByResetToken(hashedToken: string) {
    return prisma.user.findFirst({
      where: {
        resetPasswordToken: hashedToken,
        resetPasswordTokenExpiresAt: { gt: new Date() },
      },
    });
  }

  async updateUserPassword(userId: string, password: string) {
    const hashedPassword = await passwordUtils.hashPassword(password);

    return prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordTokenExpiresAt: null,
      },
    });
  }
}
