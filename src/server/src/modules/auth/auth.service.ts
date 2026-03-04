import crypto from "crypto";
import AppError from "@/shared/errors/AppError";
import sendEmail from "@/shared/utils/sendEmail";
import passwordResetTemplate from "@/shared/templates/passwordReset";
import buildRegistrationOtpTemplate from "@/shared/templates/registrationOtp";
import sendSms from "@/shared/utils/sendSms";
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
  clearRegistrationOtp,
  createRegistrationOtp,
  isRegistrationPhoneOtpEnabled,
  RegistrationOtpRateLimitError,
  verifyAndConsumeRegistrationOtp,
} from "@/shared/utils/auth/registrationOtp";
import { resolveEffectiveRole } from "@/shared/utils/userRole";
import { config } from "@/config";

const resolveClientUrl = (): string => {
  return config.isProduction ? config.urls.clientProd : config.urls.clientDev;
};

const resolveNotificationRecipients = (): string => {
  return (config.raw.BILLING_NOTIFICATION_EMAILS || "")
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
      await this.authRepository.updateUserPassword(userId, inputPassword, {
        invalidateSessions: false,
      });
      return true;
    }

    return false;
  }

  private async issuePasswordResetLink(user: {
    id: string;
    email: string;
  }): Promise<void> {
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    await this.authRepository.updateUserPasswordReset(user.email, {
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
  }

  async requestRegistrationOtp({
    email,
    phone,
    purpose = "USER_PORTAL",
    requestDealerAccess = false,
  }: RequestRegistrationOtpParams): Promise<{
    message: string;
    resendAvailableInSeconds: number;
  }> {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();
    const existingUser = await this.authRepository.findUserByEmail(normalizedEmail);
    if (existingUser) {
      throw new BadRequestError(
        "This email is already registered. Please sign in instead."
      );
    }

    if (!normalizedPhone) {
      throw new BadRequestError("Phone number is required to request OTP.");
    }

    let otpDetails: Awaited<ReturnType<typeof createRegistrationOtp>>;
    try {
      otpDetails = await createRegistrationOtp({
        email: normalizedEmail,
        phone: normalizedPhone,
        purpose,
        requestDealerAccess,
      });
    } catch (error) {
      if (error instanceof RegistrationOtpRateLimitError) {
        throw new BadRequestError(
          `OTP already sent. Please wait ${error.retryAfterSeconds} seconds before requesting a new one.`
        );
      }

      throw new AppError(
        500,
        "Unable to prepare registration OTP. Please try again in a moment."
      );
    }

    const {
      emailOtpCode,
      phoneOtpCode,
      expiresInSeconds,
      resendAvailableInSeconds,
    } = otpDetails;
    const phoneOtpEnabled = isRegistrationPhoneOtpEnabled();
    const purposeLabel =
      purpose === "DEALER_PORTAL" ? "Dealer Registration" : "Account Registration";
    const platformName = getPlatformName();
    const supportEmail = getSupportEmail();
    const otpTemplate = buildRegistrationOtpTemplate({
      platformName,
      emailOtpCode,
      purposeLabel,
      expiresInMinutes: Math.floor(expiresInSeconds / 60),
      supportEmail,
    });

    const sent = await sendEmail({
      to: normalizedEmail,
      subject: otpTemplate.subject,
      text: otpTemplate.text,
      html: otpTemplate.html,
    });

    if (!sent) {
      await clearRegistrationOtp(normalizedEmail);
      throw new AppError(
        500,
        "Failed to send OTP email. Please try again in a moment."
      );
    }

    if (phoneOtpEnabled) {
      const phoneOtpMessage = [
        `${platformName} phone verification code: ${phoneOtpCode}`,
        `For ${purposeLabel}.`,
        `Expires in ${Math.floor(expiresInSeconds / 60)} minutes.`,
        "Do not share this code.",
      ].join(" ");
      const phoneOtpSent = await sendSms({
        to: normalizedPhone,
        body: phoneOtpMessage,
      });

      if (!phoneOtpSent) {
        await clearRegistrationOtp(normalizedEmail);
        throw new AppError(
          500,
          "Failed to send phone OTP. Please try again after SMS configuration is verified."
        );
      }
    }

    return {
      message: phoneOtpEnabled
        ? `OTP sent to your email and phone. It will expire in ${Math.floor(
            expiresInSeconds / 60
          )} minutes.`
        : `OTP sent to your email. It will expire in ${Math.floor(
            expiresInSeconds / 60
          )} minutes.`,
      resendAvailableInSeconds,
    };
  }

  async registerUser({
    name,
    email,
    phone,
    password,
    emailOtpCode,
    phoneOtpCode,
    requestDealerAccess = false,
    businessName,
    contactPhone,
  }: RegisterUserParams): Promise<AuthResponse> {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = String(phone ?? "").trim();
    const existingUser = await this.authRepository.findUserByEmail(normalizedEmail);

    if (existingUser) {
      throw new AppError(
        400,
        "This email is already registered, please log in instead."
      );
    }

    if (!normalizedPhone) {
      throw new BadRequestError("Phone number is required.");
    }

    if (!emailOtpCode || !emailOtpCode.trim()) {
      throw new BadRequestError(
        "Email OTP is required. Please use the OTP sent during registration."
      );
    }

    const phoneOtpEnabled = isRegistrationPhoneOtpEnabled();

    if (phoneOtpEnabled && (!phoneOtpCode || !phoneOtpCode.trim())) {
      throw new BadRequestError(
        "Phone OTP is required. Please use the OTP sent during registration."
      );
    }

    const otpVerification = await verifyAndConsumeRegistrationOtp(
      normalizedEmail,
      normalizedPhone,
      emailOtpCode,
      phoneOtpEnabled ? phoneOtpCode : undefined
    );

    if (otpVerification.status === "EXPIRED") {
      throw new BadRequestError(
        "Registration OTP expired. Request a new OTP and try again."
      );
    }

    if (otpVerification.status === "LOCKED") {
      throw new BadRequestError(
        "Too many incorrect OTP attempts. Please request a new OTP."
      );
    }

    if (otpVerification.status === "INVALID") {
      throw new BadRequestError(
        `Invalid registration OTP ${
          phoneOtpEnabled ? "code(s)" : "code"
        }. ${otpVerification.attemptsRemaining} attempt(s) remaining.`
      );
    }

    const otpContext = otpVerification.context;
    const shouldRequestDealerAccess = otpContext.requestDealerAccess === true;
    const normalizedDealerContactPhone = contactPhone?.trim() || normalizedPhone;

    if (requestDealerAccess && !shouldRequestDealerAccess) {
      throw new BadRequestError(
        "Dealer signup requires an OTP requested from the dealer registration flow."
      );
    }

    // Registrations created through this flow always start as USER role.
    const newUser = await this.authRepository.createUser({
      email: normalizedEmail,
      phone: normalizedPhone,
      name,
      password,
      role: ROLE.USER,
    });

    const accountReference = toAccountReference(newUser.id);
    const adminsEmail = resolveNotificationRecipients();
    if (shouldRequestDealerAccess) {
      const dealerProfile = await this.authRepository.upsertDealerProfile({
        userId: newUser.id,
        businessName: businessName ?? null,
        contactPhone: normalizedDealerContactPhone,
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
            <p>Contact Phone: ${normalizedDealerContactPhone || "Not provided"}</p>
          `,
        });
      }

      return {
        user: {
          id: newUser.id,
          accountReference,
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          role: newUser.role,
          effectiveRole: resolveEffectiveRole({
            role: newUser.role,
            dealerStatus: dealerProfile?.status,
          }),
          avatar: null,
          isDealer: true,
          dealerStatus: dealerProfile?.status ?? "PENDING",
          dealerBusinessName: dealerProfile?.businessName ?? null,
          dealerContactPhone: dealerProfile?.contactPhone ?? null,
        },
        requiresApproval: true,
      };
    }

    const accessToken = tokenUtils.generateAccessToken(
      newUser.id,
      newUser.tokenVersion
    );
    const refreshToken = tokenUtils.generateRefreshToken(
      newUser.id,
      undefined,
      newUser.tokenVersion
    );

    return {
      user: {
        id: newUser.id,
        accountReference,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        effectiveRole: resolveEffectiveRole({ role: newUser.role }),
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
      effectiveRole?: "USER" | "DEALER" | "ADMIN" | "SUPERADMIN";
      name: string;
      email: string;
      phone: string | null;
      avatar: string | null;
      isDealer?: boolean;
      dealerStatus?: "PENDING" | "APPROVED" | "LEGACY" | "REJECTED" | "SUSPENDED" | null;
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

    if (dealerProfile) {
      const approvedStatuses = new Set(["APPROVED", "LEGACY"]);
      if (!approvedStatuses.has(dealerProfile.status)) {
        if (dealerProfile.status === "PENDING") {
          throw new AppError(
            403,
            "Dealer account is pending admin approval. Please wait for confirmation."
          );
        }
        if (dealerProfile.status === "SUSPENDED") {
          throw new AppError(
            403,
            "Dealer account is suspended. Please contact admin support."
          );
        }
        throw new AppError(
          403,
          "Dealer access is currently restricted. Please contact admin support."
        );
      }
    }

    const accessToken = tokenUtils.generateAccessToken(
      user.id,
      user.tokenVersion
    );
    const refreshToken = tokenUtils.generateRefreshToken(
      user.id,
      undefined,
      user.tokenVersion
    );

    return {
      accessToken,
      refreshToken,
      user: {
        accountReference: toAccountReference(user.id),
        ...user,
        effectiveRole: resolveEffectiveRole({
          role: user.role,
          dealerStatus: dealerProfile?.status,
        }),
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

  async requestOwnPasswordResetLink(
    userId: string
  ): Promise<{ message: string }> {
    const normalizedUserId = userId.trim();
    const user = await this.authRepository.findUserById(normalizedUserId);

    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (user.role !== ROLE.USER) {
      throw new AppError(
        403,
        "Admin/SuperAdmin passwords must be managed by SuperAdmin offline procedures."
      );
    }

    await this.issuePasswordResetLink({
      id: user.id,
      email: user.email,
    });

    return {
      message: `Password reset link sent to registered email address: ${user.email}`,
    };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.authRepository.findUserByEmail(normalizedEmail);

    if (!user) {
      throw new AppError(404, "This email is not registered with us.");
    }

    await this.issuePasswordResetLink({
      id: user.id,
      email: user.email,
    });

    return {
      message: `A password reset link has been sent to ${user.email}.`,
    };
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

    await this.authRepository.updateUserPassword(user.id, newPassword, {
      invalidateSessions: true,
    });

    await sendEmail({
      to: user.email,
      subject: `${platformName} | Your password was changed`,
      text:
        `Your ${platformName} account password was changed successfully. All active sessions have been logged out. If this was not you, contact ${supportEmail} immediately.`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
          <p>Hello,</p>
          <p>Your <strong>${platformName}</strong> account password was changed successfully.</p>
          <p>For your security, all active sessions have been logged out.</p>
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
      phone: string | null;
      role: string;
      effectiveRole?: "USER" | "DEALER" | "ADMIN" | "SUPERADMIN";
      avatar: string | null;
      isDealer?: boolean;
      dealerStatus?: "PENDING" | "APPROVED" | "LEGACY" | "REJECTED" | "SUSPENDED" | null;
      dealerBusinessName?: string | null;
      dealerContactPhone?: string | null;
    };
    newAccessToken: string;
    newRefreshToken: string;
  }> {
    if (await tokenUtils.isTokenBlacklisted(oldRefreshToken)) {
      throw new NotFoundError("Refresh token");
    }

    const decoded = jwt.verify(
      oldRefreshToken,
      config.auth.refreshTokenSecret
    ) as { id: string; absExp: number; tv?: number };

    const absoluteExpiration = decoded.absExp;
    const now = Math.floor(Date.now() / 1000);
    if (now > absoluteExpiration) {
      throw new AppError(401, "Session expired. Please log in again.");
    }

    const user = await this.authRepository.findUserById(decoded.id);

    if (!user) {
      throw new NotFoundError("User");
    }

    const refreshTokenVersion = typeof decoded.tv === "number" ? decoded.tv : 0;
    if (refreshTokenVersion !== user.tokenVersion) {
      throw new AppError(401, "Session expired. Please log in again.");
    }

    if (user.dealerProfile) {
      const approvedStatuses = new Set(["APPROVED", "LEGACY"]);
      if (!approvedStatuses.has(user.dealerProfile.status)) {
        if (user.dealerProfile.status === "PENDING") {
          throw new AppError(
            403,
            "Dealer account is pending admin approval. Please wait for confirmation."
          );
        }
        if (user.dealerProfile.status === "SUSPENDED") {
          throw new AppError(
            403,
            "Dealer account is suspended. Please contact admin support."
          );
        }
        throw new AppError(
          403,
          "Dealer access is currently restricted. Please contact admin support."
        );
      }
    }

    const normalizedUser = {
      id: user.id,
      accountReference: toAccountReference(user.id),
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      role: user.role,
      effectiveRole: resolveEffectiveRole({
        role: user.role,
        dealerStatus: user.dealerProfile?.status,
      }),
      avatar: user.avatar,
      isDealer: !!user.dealerProfile,
      dealerStatus: user.dealerProfile?.status ?? null,
      dealerBusinessName: user.dealerProfile?.businessName ?? null,
      dealerContactPhone: user.dealerProfile?.contactPhone ?? null,
    };

    const newAccessToken = tokenUtils.generateAccessToken(
      user.id,
      user.tokenVersion
    );
    const newRefreshToken = tokenUtils.generateRefreshToken(
      user.id,
      absoluteExpiration,
      user.tokenVersion
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
