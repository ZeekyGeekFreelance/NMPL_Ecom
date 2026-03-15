import prisma from "@/infra/database/database.config";
import { ROLE } from "@prisma/client";
import { passwordUtils } from "@/shared/utils/authUtils";
import { clearProtectUserCache } from "@/shared/utils/auth/protectCache";
import {
  findDealerProfileByUserId as sharedFindDealerProfileByUserId,
  upsertDealerProfile as sharedUpsertDealerProfile,
} from "@/shared/repositories/dealer.repository";

export type { DealerStatus, DealerProfileRecord } from "@/shared/repositories/dealer.repository";

export class AuthRepository {

  async findUserByEmail(email: string) {
    return prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
  }

  async findUserByEmailWithPassword(email: string) {
    return prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: {
        id: true,
        password: true,
        tokenVersion: true,
        role: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        mustChangePassword: true,
      },
    });
  }

  /**
   * Fetches a user by ID including their hashed password.
   * Used by changeOwnPassword — the user is authenticated (we have their ID
   * from the JWT) but we still re-verify their current password before
   * allowing the change.
   */
  async findUserByIdWithPassword(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatar: true,
        tokenVersion: true,
        password: true,
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

    if (!user) return null;

    const dealerProfile = await this.findDealerProfileByUserId(user.id);
    return { ...user, dealerProfile };
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
      data: { ...data, password: hashedPassword },
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

  // ── Dealer profile — delegate to shared repository ──────────────────────

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
    return prisma.user.update({ where: { id: userId }, data });
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

    if (typeof updateData.password === "string") {
      updateData.password = await passwordUtils.hashPassword(updateData.password);
    }

    const user = await this.findUserByEmail(email);
    if (!user) return null;

    return prisma.user.update({ where: { id: user.id }, data: updateData });
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
   * Clears the password-reset token without changing the password.
   * Used when a privileged account's token must be invalidated without
   * completing the reset.
   */
  async clearResetToken(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        resetPasswordToken: null,
        resetPasswordTokenExpiresAt: null,
      },
    });
  }

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
    const hashedPassword = await passwordUtils.hashPassword(password);
    const invalidateSessions = options?.invalidateSessions ?? true;

    const result = await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordTokenExpiresAt: null,
        ...(invalidateSessions ? { tokenVersion: { increment: 1 } } : {}),
      },
    });

    // Immediately evict the protect-middleware cache entry so the new
    // tokenVersion is picked up on the very next request without a 60s lag.
    if (invalidateSessions) {
      await clearProtectUserCache(userId);
    }

    return result;
  }
}
