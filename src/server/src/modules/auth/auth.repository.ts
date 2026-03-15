import prisma from "@/infra/database/database.config";
import { ROLE } from "@prisma/client";
import AppError from "@/shared/errors/AppError";
import { passwordUtils } from "@/shared/utils/authUtils";
import { clearProtectUserCache } from "@/shared/utils/auth/protectCache";
import {
  findDealerProfileByUserId as sharedFindDealerProfileByUserId,
  upsertDealerProfile as sharedUpsertDealerProfile,
} from "@/shared/repositories/dealer.repository";

// Re-export types so existing imports from auth.repository continue to work
export type { DealerStatus, DealerProfileRecord } from "@/shared/repositories/dealer.repository";

export class AuthRepository {

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
        tokenVersion: true,
        role: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        /** Checked immediately after sign-in to gate token issuance. */
        mustChangePassword: true,
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
        tokenVersion: true,
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
        tokenVersion: true,
      },
    });
  }

  // ── Dealer profile methods — delegate to shared repository ──────────────
  // Single source of truth: @/shared/repositories/dealer.repository

  async findDealerProfileByUserId(
    userId: string
  ): Promise<import("@/shared/repositories/dealer.repository").DealerProfileRecord | null> {
    return sharedFindDealerProfileByUserId(userId);
  }

  async upsertDealerProfile(data: {
    userId: string;
    businessName?: string | null;
    contactPhone?: string | null;
    status: import("@/shared/repositories/dealer.repository").DealerStatus;
    approvedBy?: string | null;
  }): Promise<import("@/shared/repositories/dealer.repository").DealerProfileRecord | null> {
    return sharedUpsertDealerProfile(data);
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
    const updateData = { ...data };
    
    // Hash the user-provided password before storage (never store plaintext)
    if (typeof updateData.password === "string") {
      const userProvidedPassword = updateData.password;
      updateData.password = await passwordUtils.hashPassword(userProvidedPassword);
    }

    const user = await this.findUserByEmail(email);
    if (!user) {
      return null;
    }

    return prisma.user.update({
      where: { id: user.id },
      data: updateData,
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

  /**
   * Clears the mustChangePassword flag after a successful first-login
   * password change.  Called only from changePasswordOnFirstLogin.
   */
  async clearMustChangePassword(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { mustChangePassword: false },
    });
  }

  async updateUserPassword(
    userId: string,
    password: string,
    options?: { invalidateSessions?: boolean }
  ) {
    // Hash the user-provided password before storage (never store plaintext)
    const userProvidedPassword = password;
    const hashedPassword = await passwordUtils.hashPassword(userProvidedPassword);
    const invalidateSessions = options?.invalidateSessions ?? true;

    const result = await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordTokenExpiresAt: null,
        ...(invalidateSessions
          ? { tokenVersion: { increment: 1 } }
          : {}),
      },
    });

    // Invalidate the protect middleware cache so the new tokenVersion
    // is picked up on the very next request — no 60-second lag.
    if (invalidateSessions) {
      await clearProtectUserCache(userId);
    }

    return result;
  }
}
