import crypto from "crypto";
import AppError from "@/shared/errors/AppError";
import sendEmail from "@/shared/utils/sendEmail";
import passwordResetTemplate from "@/shared/templates/passwordReset";
import emailVerificationTemplate from "@/shared/templates/emailVerification";
import { tokenUtils, passwordUtils } from "@/shared/utils/authUtils";
import {
  AuthResponse,
  RegisterUserParams,
  RequestRegistrationOtpParams,
  SignInParams,
} from "./auth.types";
import { ROLE } from "@prisma/client";
import logger from "@/infra/winston/logger";
import jwt from "jsonwebtoken";
import { AuthRepository } from "./auth.repository";
import BadRequestError from "@/shared/errors/BadRequestError";
import NotFoundError from "@/shared/errors/NotFoundError";
import { toAccountReference } from "@/shared/utils/accountReference";
import { getPlatformName, getSupportEmail } from "@/shared/utils/branding";
import { DealerNotificationService } from "@/shared/services/dealerNotification.service";
import {
  createRegistrationOtp,
  hasPendingRegistrationOtp,
  verifyAndConsumeRegistrationOtp,
} from "@/shared/utils/auth/registrationOtp";

const resolveClientUrl = (): string => {
  return (
    process.env.CLIENT_URL ||
    process.env.CLIENT_URL_DEV ||
    process.env.CLIENT_URL_PROD ||
    ""
  );
};

const resolveNotificationRecipients = (): string => {
  return (process.env.BILLING_NOTIFICATION_EMAILS || "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean)
    .join(",");
};

export class AuthService {
  constructor(
    private authRepository: AuthRepository,
    private dealerNotificationService?: DealerNotificationService
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private isBcryptHash(password: string): boolean {
    return /^\$2[aby]\$\d{2}\$/.test(password);
  }

  private async verifyPassword({
    userId,
    inputPassword,
    storedPassword,
  }: {
    userId: string;
    inputPassword: string;
    storedPassword: string;
  }): Promise<boolean> {
    if (this.isBcryptHash(storedPassword)) {
      return passwordUtils.comparePassword(inputPassword, storedPassword);
    }

    if (storedPassword === inputPassword) {
      // Upgrade legacy plain-text passwords after first successful login.
      await this.authRepository.updateUserPassword(userId, inputPassword);
      return true;
    }

    return false;
  }

  async requestRegistrationOtp({
    email,
    purpose = "USER_PORTAL",
    requestDealerAccess = false,
  }: RequestRegistrationOtpParams): Promise<{ message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await this.authRepository.findUserByEmail(normalizedEmail);
    if (existingUser) {
      throw new BadRequestError(
        "This email is already registered. Please sign in instead."
      );
    }

    const { otpCode, expiresInSeconds } = await createRegistrationOtp({
      email: normalizedEmail,
      purpose,
      requestDealerAccess,
    });

    const sent = await sendEmail({
      to: normalizedEmail,
      subject: "Your registration OTP code",
      text: `Your OTP code is ${otpCode}. It expires in ${Math.floor(
        expiresInSeconds / 60
      )} minutes.`,
      html: emailVerificationTemplate(otpCode),
    });

    if (!sent) {
      throw new AppError(
        500,
        "Failed to send OTP email. Please try again in a moment."
      );
    }

    return {
      message: `OTP sent successfully. It will expire in ${Math.floor(
        expiresInSeconds / 60
      )} minutes.`,
    };
  }

  async registerUser({
    name,
    email,
    password,
    otpCode,
    requestDealerAccess = false,
    businessName,
    contactPhone,
  }: RegisterUserParams): Promise<AuthResponse> {
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await this.authRepository.findUserByEmail(normalizedEmail);

    if (existingUser) {
      throw new AppError(
        400,
        "This email is already registered, please log in instead."
      );
    }

    const pendingOtp = await hasPendingRegistrationOtp(normalizedEmail);
    if (pendingOtp && !otpCode) {
      throw new BadRequestError(
        "Registration OTP is required. Please use the OTP sent to your email."
      );
    }

    let otpContext: Awaited<
      ReturnType<typeof verifyAndConsumeRegistrationOtp>
    > = null;
    if (otpCode) {
      otpContext = await verifyAndConsumeRegistrationOtp(
        normalizedEmail,
        otpCode
      );
      if (!otpContext) {
        throw new BadRequestError("Invalid or expired registration OTP code.");
      }
    }

    const shouldRequestDealerAccess =
      requestDealerAccess || otpContext?.requestDealerAccess === true;

    // Force new registrations to be USER role only for security
    const newUser = await this.authRepository.createUser({
      email: normalizedEmail,
      name,
      password,
      role: ROLE.USER, // Ignore any role passed from client for security
    });

    const accountReference = toAccountReference(newUser.id);
    const adminsEmail = resolveNotificationRecipients();
    if (shouldRequestDealerAccess) {
      const dealerProfile = await this.authRepository.upsertDealerProfile({
        userId: newUser.id,
        businessName: businessName ?? null,
        contactPhone: contactPhone ?? null,
        status: "PENDING",
        approvedBy: null,
      });

      await this.dealerNotificationService?.sendDealerApplicationSubmitted({
        recipientName: newUser.name,
        recipientEmail: newUser.email,
        businessName: dealerProfile?.businessName ?? null,
        accountReference,
      });

      if (adminsEmail) {
        await sendEmail({
          to: adminsEmail,
          subject: `Dealer access request: ${name}`,
          text: `${name} (${normalizedEmail}) requested dealer access.`,
          html: `
            <p><strong>Dealer access request received</strong></p>
            <p>Name: ${name}</p>
            <p>Email: ${normalizedEmail}</p>
            <p>Business Name: ${businessName || "Not provided"}</p>
            <p>Contact Phone: ${contactPhone || "Not provided"}</p>
          `,
        });
      }

      return {
        user: {
          id: newUser.id,
          accountReference,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          avatar: null,
          isDealer: true,
          dealerStatus: dealerProfile?.status ?? "PENDING",
          dealerBusinessName: dealerProfile?.businessName ?? null,
          dealerContactPhone: dealerProfile?.contactPhone ?? null,
        },
        requiresApproval: true,
      };
    }

    const accessToken = tokenUtils.generateAccessToken(newUser.id);
    const refreshToken = tokenUtils.generateRefreshToken(newUser.id);

    return {
      user: {
        id: newUser.id,
        accountReference,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        avatar: null,
        isDealer: false,
        dealerStatus: null,
        dealerBusinessName: null,
        dealerContactPhone: null,
      },
      accessToken,
      refreshToken,
    };
  }

  async signin({ email, password }: SignInParams): Promise<{
    user: {
      id: string;
      accountReference: string;
      role: ROLE;
      name: string;
      email: string;
      avatar: string | null;
      isDealer?: boolean;
      dealerStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
      dealerBusinessName?: string | null;
      dealerContactPhone?: string | null;
    };
    accessToken: string;
    refreshToken: string;
  }> {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.authRepository.findUserByEmailWithPassword(
      normalizedEmail
    );

    if (!user) {
      throw new BadRequestError("Email or password is incorrect.");
    }

    if (!user.password) {
      throw new AppError(400, "Email or password is incorrect.");
    }
    const isPasswordValid = await this.verifyPassword({
      userId: user.id,
      inputPassword: password,
      storedPassword: user.password,
    });
    if (!isPasswordValid) {
      throw new AppError(400, "Email or password is incorrect.");
    }

    const dealerProfile = await this.authRepository.findDealerProfileByUserId(
      user.id
    );

    if (dealerProfile && dealerProfile.status !== "APPROVED") {
      if (dealerProfile.status === "PENDING") {
        throw new AppError(
          403,
          "Dealer account is pending admin approval. Please wait for confirmation."
        );
      }

      throw new AppError(
        403,
        "Dealer access is currently restricted. Please contact admin support."
      );
    }

    const accessToken = tokenUtils.generateAccessToken(user.id);
    const refreshToken = tokenUtils.generateRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      user: {
        accountReference: toAccountReference(user.id),
        ...user,
        isDealer: !!dealerProfile,
        dealerStatus: dealerProfile?.status ?? null,
        dealerBusinessName: dealerProfile?.businessName ?? null,
        dealerContactPhone: dealerProfile?.contactPhone ?? null,
      },
    };
  }

  async signout(): Promise<{ message: string }> {
    return { message: "User logged out successfully" };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.authRepository.findUserByEmail(normalizedEmail);
    const platformName = getPlatformName();
    const supportEmail = getSupportEmail();
    const successResponse = {
      message:
        `If an account exists for this email, a ${platformName} password reset link has been sent.`,
    };

    if (!user) {
      // Avoid email enumeration.
      return successResponse;
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    await this.authRepository.updateUserPasswordReset(normalizedEmail, {
      resetPasswordToken: hashedToken,
      resetPasswordTokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const clientUrl = resolveClientUrl();
    const resetUrl = `${clientUrl}/password-reset/${resetToken}`;
    const htmlTemplate = passwordResetTemplate(resetUrl);

    await sendEmail({
      to: user.email,
      subject: "Reset your password",
      html: htmlTemplate,
      text: "Reset your password",
    });

    return { message: "Password reset email sent successfully" };
  }

  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<{ message: string }> {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const platformName = getPlatformName();
    const supportEmail = getSupportEmail();

    const user = await this.authRepository.findUserByResetToken(hashedToken);

    if (!user) {
      throw new BadRequestError("Invalid or expired reset token");
    }

    await this.authRepository.updateUserPassword(user.id, newPassword);

    await sendEmail({
      to: user.email,
      subject: `${platformName} | Your password was changed`,
      text:
        `Your ${platformName} account password was changed successfully. If this was not you, contact ${supportEmail} immediately.`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
          <p>Hello,</p>
          <p>Your <strong>${platformName}</strong> account password was changed successfully.</p>
          <p>If this was not you, contact <a href="mailto:${supportEmail}">${supportEmail}</a> immediately and reset your password again.</p>
        </div>
      `,
    });

    return {
      message: `Password reset successful for ${platformName}. You can now sign in.`,
    };
  }

  async refreshToken(oldRefreshToken: string): Promise<{
    user: {
      id: string;
      accountReference: string;
      name: string;
      email: string;
      role: string;
      avatar: string | null;
      isDealer?: boolean;
      dealerStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
      dealerBusinessName?: string | null;
      dealerContactPhone?: string | null;
    };
    newAccessToken: string;
    newRefreshToken: string;
  }> {
    if (await tokenUtils.isTokenBlacklisted(oldRefreshToken)) {
      throw new NotFoundError("Refresh token");
    }

    const refreshSecret = process.env.REFRESH_TOKEN_SECRET;
    if (!refreshSecret) {
      throw new AppError(500, "Refresh token secret is not configured.");
    }

    const decoded = jwt.verify(
      oldRefreshToken,
      refreshSecret
    ) as { id: string; absExp: number };

    const absoluteExpiration = decoded.absExp;
    const now = Math.floor(Date.now() / 1000);
    if (now > absoluteExpiration) {
      throw new AppError(401, "Session expired. Please log in again.");
    }

    const user = await this.authRepository.findUserById(decoded.id);

    if (!user) {
      throw new NotFoundError("User");
    }

    if (user.dealerProfile && user.dealerProfile.status !== "APPROVED") {
      if (user.dealerProfile.status === "PENDING") {
        throw new AppError(
          403,
          "Dealer account is pending admin approval. Please wait for confirmation."
        );
      }

      throw new AppError(
        403,
        "Dealer access is currently restricted. Please contact admin support."
      );
    }

    const normalizedUser = {
      id: user.id,
      accountReference: toAccountReference(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      isDealer: !!user.dealerProfile,
      dealerStatus: user.dealerProfile?.status ?? null,
      dealerBusinessName: user.dealerProfile?.businessName ?? null,
      dealerContactPhone: user.dealerProfile?.contactPhone ?? null,
    };

    const newAccessToken = tokenUtils.generateAccessToken(user.id);
    const newRefreshToken = tokenUtils.generateRefreshToken(
      user.id,
      absoluteExpiration
    );

    const oldTokenTTL = absoluteExpiration - now;
    if (oldTokenTTL > 0) {
      await tokenUtils.blacklistToken(oldRefreshToken, oldTokenTTL);
    } else {
      logger.warn("Refresh token is already expired. No need to blacklist.");
    }

    return { user: normalizedUser, newAccessToken, newRefreshToken };
  }
}
