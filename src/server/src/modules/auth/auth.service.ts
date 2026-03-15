import crypto from "crypto";
import AppError from "@/shared/errors/AppError";
import sendEmail from "@/shared/utils/sendEmail";
import passwordResetTemplate from "@/shared/templates/passwordReset";
import buildRegistrationOtpTemplate from "@/shared/templates/registrationOtp";
import sendSms from "@/shared/utils/sendSms";
import { tokenUtils, passwordUtils } from "@/shared/utils/authUtils";
import {
  ApplyDealerAccessParams,
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

// Roles whose passwords may NOT be reset via the public unauthenticated flow.
// ADMIN and SUPERADMIN use authenticated flows only (changeOwnPassword or
// SuperAdmin-initiated out-of-band reset).
const PRIVILEGED_ROLES = new Set<ROLE>([ROLE.ADMIN, ROLE.SUPERADMIN]);

export class AuthService {
  constructor(
    private authRepository: AuthRepository,
    private dealerNotificationService?: DealerNotificationService
  ) { }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizePhone(phone: string, label = "Phone number"): string {
    const normalized = String(phone ?? "").trim();
    if (!normalized) throw new BadRequestError(`${label} is required.`);
    if (!/^\d{10}$/.test(normalized)) throw new BadRequestError(`${label} must be exactly 10 digits.`);
    return normalized;
  }

  private isBcryptHash(password: string): boolean {
    return /^\$2[aby]\$\d{2}\$/.test(password);
  }

  private async verifyPassword({
    inputPassword,
    storedPassword,
  }: {
    userId: string;
    inputPassword: string;
    storedPassword: string;
  }): Promise<boolean> {
    if (!this.isBcryptHash(storedPassword)) return false;
    return passwordUtils.comparePassword(inputPassword, storedPassword);
  }

  private assertPasswordStrength(password: string, label = "Password"): void {
    const value = String(password ?? "").trim();
    if (value.length < 8) throw new AppError(400, `${label} must be at least 8 characters long.`);
    if (!/[A-Z]/.test(value)) throw new AppError(400, `${label} must contain at least one uppercase letter.`);
    if (!/[a-z]/.test(value)) throw new AppError(400, `${label} must contain at least one lowercase letter.`);
    if (!/[0-9]/.test(value)) throw new AppError(400, `${label} must contain at least one number.`);
    if (!/[!@#$%^&*]/.test(value)) throw new AppError(400, `${label} must contain at least one special character (!@#$%^&*).`);
  }

  private async issuePasswordResetLink(user: { id: string; email: string }): Promise<void> {
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    await this.authRepository.updateUserPasswordReset(user.email, {
      resetPasswordToken: hashedToken,
      resetPasswordTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const clientUrl = resolveClientUrl();
    const resetUrl = `${clientUrl}/password-reset/${resetToken}`;
    const htmlTemplate = passwordResetTemplate(resetUrl, { expiresInMinutes: 15 });

    await sendEmail({
      to: user.email,
      subject: "Reset your password",
      html: htmlTemplate,
      text: `Reset your password: ${resetUrl} (expires in 15 minutes)`,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REGISTRATION
  // ─────────────────────────────────────────────────────────────────────────

  async requestRegistrationOtp({
    email, phone, purpose = "USER_PORTAL", requestDealerAccess = false,
  }: RequestRegistrationOtpParams): Promise<{ message: string; resendAvailableInSeconds: number }> {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = this.normalizePhone(phone);
    const existingUser = await this.authRepository.findUserByEmail(normalizedEmail);
    if (existingUser) throw new BadRequestError("This email is already registered. Please sign in instead.");

    let otpDetails: Awaited<ReturnType<typeof createRegistrationOtp>>;
    try {
      otpDetails = await createRegistrationOtp({ email: normalizedEmail, phone: normalizedPhone, purpose, requestDealerAccess });
    } catch (error) {
      if (error instanceof RegistrationOtpRateLimitError) {
        throw new BadRequestError(`OTP already sent. Please wait ${error.retryAfterSeconds} seconds before requesting a new one.`);
      }
      throw new AppError(500, "Unable to prepare registration OTP. Please try again in a moment.");
    }

    const { emailOtpCode, phoneOtpCode, expiresInSeconds, resendAvailableInSeconds } = otpDetails;
    const phoneOtpEnabled = isRegistrationPhoneOtpEnabled();
    const purposeLabel = purpose === "DEALER_PORTAL" ? "Dealer Registration" : "Account Registration";
    const platformName = getPlatformName();
    const supportEmail = getSupportEmail();
    const otpTemplate = buildRegistrationOtpTemplate({ platformName, emailOtpCode, purposeLabel, expiresInMinutes: Math.floor(expiresInSeconds / 60), supportEmail });

    const sent = await sendEmail({ to: normalizedEmail, subject: otpTemplate.subject, text: otpTemplate.text, html: otpTemplate.html });
    if (!sent) {
      await clearRegistrationOtp(normalizedEmail);
      throw new AppError(500, "Failed to send OTP email. Please try again in a moment.");
    }

    if (phoneOtpEnabled) {
      const phoneOtpMessage = [`${platformName} phone verification code: ${phoneOtpCode}`, `For ${purposeLabel}.`, `Expires in ${Math.floor(expiresInSeconds / 60)} minutes.`, "Do not share this code."].join(" ");
      const phoneOtpSent = await sendSms({ to: normalizedPhone, body: phoneOtpMessage });
      if (!phoneOtpSent) {
        await clearRegistrationOtp(normalizedEmail);
        throw new AppError(500, "Failed to send phone OTP. Please try again after SMS configuration is verified.");
      }
    }

    return {
      message: phoneOtpEnabled
        ? `OTP sent to your email and phone. It will expire in ${Math.floor(expiresInSeconds / 60)} minutes.`
        : `OTP sent to your email. It will expire in ${Math.floor(expiresInSeconds / 60)} minutes.`,
      resendAvailableInSeconds,
    };
  }

  async registerUser({
    name, email, phone, password, emailOtpCode, phoneOtpCode,
    requestDealerAccess = false, businessName, contactPhone,
  }: RegisterUserParams): Promise<AuthResponse> {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = this.normalizePhone(String(phone ?? ""));
    const existingUser = await this.authRepository.findUserByEmail(normalizedEmail);
    if (existingUser) throw new AppError(400, "This email is already registered, please log in instead.");
    if (!emailOtpCode || !emailOtpCode.trim()) throw new BadRequestError("Email OTP is required. Please use the OTP sent during registration.");

    const phoneOtpEnabled = isRegistrationPhoneOtpEnabled();
    if (phoneOtpEnabled && (!phoneOtpCode || !phoneOtpCode.trim())) throw new BadRequestError("Phone OTP is required. Please use the OTP sent during registration.");

    const otpVerification = await verifyAndConsumeRegistrationOtp(normalizedEmail, normalizedPhone, emailOtpCode, phoneOtpEnabled ? phoneOtpCode : undefined);
    if (otpVerification.status === "EXPIRED") throw new BadRequestError("Registration OTP expired. Request a new OTP and try again.");
    if (otpVerification.status === "LOCKED") throw new BadRequestError("Too many incorrect OTP attempts. Please request a new OTP.");
    if (otpVerification.status === "INVALID") throw new BadRequestError(`Invalid registration OTP ${phoneOtpEnabled ? "code(s)" : "code"}. ${otpVerification.attemptsRemaining} attempt(s) remaining.`);

    const otpContext = otpVerification.context;
    const shouldRequestDealerAccess = otpContext.requestDealerAccess === true;
    const normalizedDealerContactPhone = contactPhone ? this.normalizePhone(contactPhone, "Contact phone") : normalizedPhone;
    if (requestDealerAccess && !shouldRequestDealerAccess) throw new BadRequestError("Dealer signup requires an OTP requested from the dealer registration flow.");

    const newUser = await this.authRepository.createUser({ email: normalizedEmail, phone: normalizedPhone, name, password, role: ROLE.USER });
    const accountReference = toAccountReference(newUser.id);
    const adminsEmail = resolveNotificationRecipients();

    if (shouldRequestDealerAccess) {
      const dealerProfile = await this.authRepository.upsertDealerProfile({ userId: newUser.id, businessName: businessName ?? null, contactPhone: normalizedDealerContactPhone, status: "PENDING", approvedBy: null });
      await this.dealerNotificationService?.sendDealerApplicationSubmitted({ recipientName: newUser.name, recipientEmail: newUser.email, businessName: dealerProfile?.businessName ?? null, accountReference });
      if (adminsEmail) {
        await sendEmail({ to: adminsEmail, subject: `Dealer access request: ${name}`, text: `${name} (${normalizedEmail}) requested dealer access.`, html: `<p><strong>Dealer access request received</strong></p><p>Name: ${name}</p><p>Email: ${normalizedEmail}</p><p>Business: ${businessName || "Not provided"}</p>` });
      }
      return {
        user: { id: newUser.id, accountReference, name: newUser.name, email: newUser.email, phone: newUser.phone, role: newUser.role, effectiveRole: resolveEffectiveRole({ role: newUser.role, dealerStatus: dealerProfile?.status }), avatar: null, isDealer: true, dealerStatus: dealerProfile?.status ?? "PENDING", dealerBusinessName: dealerProfile?.businessName ?? null, dealerContactPhone: dealerProfile?.contactPhone ?? null },
        requiresApproval: true,
      };
    }

    const accessToken = tokenUtils.generateAccessToken(newUser.id, newUser.tokenVersion);
    const refreshToken = tokenUtils.generateRefreshToken(newUser.id, undefined, newUser.tokenVersion);
    return {
      user: { id: newUser.id, accountReference, name: newUser.name, email: newUser.email, phone: newUser.phone, role: newUser.role, effectiveRole: resolveEffectiveRole({ role: newUser.role }), avatar: null, isDealer: false, dealerStatus: null, dealerBusinessName: null, dealerContactPhone: null },
      accessToken,
      refreshToken,
    };
  }

  async applyDealerAccessForCurrentUser({ userId, businessName, contactPhone }: ApplyDealerAccessParams): Promise<{
    user: { id: string; accountReference: string; name: string; email: string; phone: string | null; role: ROLE; effectiveRole?: "USER" | "DEALER" | "ADMIN" | "SUPERADMIN"; avatar: string | null; isDealer?: boolean; dealerStatus?: "PENDING" | "APPROVED" | "LEGACY" | "REJECTED" | "SUSPENDED" | null; dealerBusinessName?: string | null; dealerContactPhone?: string | null };
    wasResubmission: boolean;
  }> {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId) throw new AppError(401, "User not authenticated.");
    const currentUser = await this.authRepository.findUserById(normalizedUserId);
    if (!currentUser) throw new AppError(404, "User not found.");
    if (currentUser.role !== ROLE.USER) throw new AppError(403, "Only USER accounts can request dealership access.");

    const existingDealerProfile = await this.authRepository.findDealerProfileByUserId(currentUser.id);
    const existingStatus = existingDealerProfile?.status ?? null;
    if (existingStatus === "APPROVED" || existingStatus === "LEGACY") throw new AppError(400, "Your account already has dealer access.");

    const normalizedBusinessName = typeof businessName === "string" && businessName.trim() ? businessName.trim() : existingDealerProfile?.businessName ?? null;
    const normalizedContactPhone = this.normalizePhone(String(contactPhone ?? currentUser.phone ?? "").trim(), "Contact phone");

    const dealerProfile = await this.authRepository.upsertDealerProfile({ userId: currentUser.id, businessName: normalizedBusinessName, contactPhone: normalizedContactPhone, status: "PENDING", approvedBy: null });
    const accountReference = toAccountReference(currentUser.id);
    const wasResubmission = existingStatus === "REJECTED" || existingStatus === "SUSPENDED";

    await this.dealerNotificationService?.sendDealerApplicationSubmitted({ recipientName: currentUser.name, recipientEmail: currentUser.email, businessName: dealerProfile?.businessName ?? normalizedBusinessName, accountReference, wasResubmission });

    const adminsEmail = resolveNotificationRecipients();
    if (adminsEmail) {
      await sendEmail({ to: adminsEmail, subject: `Dealer access request: ${currentUser.name}`, text: `${currentUser.name} (${currentUser.email}) requested dealer access.`, html: `<p><strong>Dealer access request received</strong></p><p>Name: ${currentUser.name}</p><p>Email: ${currentUser.email}</p>` });
    }

    return {
      user: { id: currentUser.id, accountReference, name: currentUser.name, email: currentUser.email, phone: currentUser.phone, role: currentUser.role, effectiveRole: resolveEffectiveRole({ role: currentUser.role, dealerStatus: dealerProfile?.status ?? "PENDING" }), avatar: currentUser.avatar, isDealer: true, dealerStatus: dealerProfile?.status ?? "PENDING", dealerBusinessName: dealerProfile?.businessName ?? normalizedBusinessName, dealerContactPhone: dealerProfile?.contactPhone ?? normalizedContactPhone },
      wasResubmission,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SIGN IN / SIGN OUT / REFRESH
  // ─────────────────────────────────────────────────────────────────────────

  async signin({ email, password, portal = "USER_PORTAL" }: SignInParams): Promise<{
    requiresPasswordChange?: boolean;
    user: { id: string; accountReference: string; role: ROLE; effectiveRole?: "USER" | "DEALER" | "ADMIN" | "SUPERADMIN"; name: string; email: string; phone: string | null; avatar: string | null; isDealer?: boolean; dealerStatus?: "PENDING" | "APPROVED" | "LEGACY" | "REJECTED" | "SUSPENDED" | null; dealerBusinessName?: string | null; dealerContactPhone?: string | null };
    accessToken?: string;
    refreshToken?: string;
  }> {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.authRepository.findUserByEmailWithPassword(normalizedEmail);
    if (!user) throw new BadRequestError("Email or password is incorrect.");
    if (!user.password) throw new AppError(400, "Email or password is incorrect.");

    const isPasswordValid = await this.verifyPassword({ userId: user.id, inputPassword: password, storedPassword: user.password });
    if (!isPasswordValid) throw new AppError(400, "Email or password is incorrect.");

    const dealerProfile = await this.authRepository.findDealerProfileByUserId(user.id);
    const effectiveRole = resolveEffectiveRole({ role: user.role, dealerStatus: dealerProfile?.status });
    const normalizedPortal = String(portal || "USER_PORTAL").toUpperCase();

    if (dealerProfile?.status === "SUSPENDED") throw new AppError(403, "Your dealer account has been suspended. Please contact admin support.");
    if (normalizedPortal === "USER_PORTAL" && effectiveRole === "DEALER") throw new AppError(403, "Email ID is registered for Dealer Account. Login as Dealer");
    if (normalizedPortal === "DEALER_PORTAL" && effectiveRole !== "DEALER") {
      if (dealerProfile?.status === "PENDING") throw new AppError(403, "Dealer access request is pending approval. Please wait for admin review.");
      if (dealerProfile?.status === "REJECTED") throw new AppError(403, "Dealer access request was rejected. Please contact admin support.");
      throw new AppError(403, "Email ID is not registered for Dealer Account. Login as User");
    }
    if (effectiveRole === "DEALER") {
      if (!dealerProfile) throw new AppError(403, "Dealer profile is missing. Please contact admin support.");
      const approvedStatuses = new Set(["APPROVED", "LEGACY"]);
      if (!approvedStatuses.has(dealerProfile.status)) throw new AppError(403, "Dealer access is currently restricted. Please contact admin support.");
    }

    if (user.mustChangePassword) {
      return { requiresPasswordChange: true, user: { accountReference: toAccountReference(user.id), id: user.id, name: user.name, email: user.email, phone: user.phone ?? null, role: user.role, effectiveRole, avatar: user.avatar ?? null, isDealer: !!dealerProfile, dealerStatus: dealerProfile?.status ?? null, dealerBusinessName: dealerProfile?.businessName ?? null, dealerContactPhone: dealerProfile?.contactPhone ?? null }, accessToken: undefined, refreshToken: undefined };
    }

    const accessToken = tokenUtils.generateAccessToken(user.id, user.tokenVersion);
    const refreshToken = tokenUtils.generateRefreshToken(user.id, undefined, user.tokenVersion);
    return { accessToken, refreshToken, user: { accountReference: toAccountReference(user.id), ...user, effectiveRole, isDealer: !!dealerProfile, dealerStatus: dealerProfile?.status ?? null, dealerBusinessName: dealerProfile?.businessName ?? null, dealerContactPhone: dealerProfile?.contactPhone ?? null } };
  }

  async signout(): Promise<{ message: string }> {
    return { message: "User logged out successfully" };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FORCED FIRST-LOGIN PASSWORD CHANGE (legacy dealers)
  // ─────────────────────────────────────────────────────────────────────────

  async changePasswordOnFirstLogin(params: { email: string; currentPassword: string; newPassword: string }): Promise<{
    user: { id: string; accountReference: string; name: string; email: string; phone: string | null; role: ROLE; effectiveRole?: "USER" | "DEALER" | "ADMIN" | "SUPERADMIN"; avatar: string | null; isDealer?: boolean; dealerStatus?: string | null };
    accessToken: string;
    refreshToken: string;
  }> {
    const normalizedEmail = this.normalizeEmail(params.email);
    const user = await this.authRepository.findUserByEmailWithPassword(normalizedEmail);
    if (!user) throw new BadRequestError("Email or password is incorrect.");
    if (!user.mustChangePassword) throw new AppError(400, "No forced password change is required for this account.");
    if (!user.password) throw new AppError(400, "Email or password is incorrect.");

    const isPasswordValid = await this.verifyPassword({ userId: user.id, inputPassword: params.currentPassword, storedPassword: user.password });
    if (!isPasswordValid) throw new AppError(400, "Current password is incorrect.");

    const newPasswordValue = String(params.newPassword || "").trim();
    this.assertPasswordStrength(newPasswordValue, "New password");
    if (newPasswordValue === params.currentPassword) throw new AppError(400, "New password must be different from the current temporary password.");

    await this.authRepository.updateUserPassword(user.id, newPasswordValue, { invalidateSessions: true });
    await this.authRepository.clearMustChangePassword(user.id);

    const refreshedUser = await this.authRepository.findUserById(user.id);
    if (!refreshedUser) throw new AppError(500, "User not found after password update.");

    const dealerProfile = await this.authRepository.findDealerProfileByUserId(user.id);
    const effectiveRole = resolveEffectiveRole({ role: refreshedUser.role, dealerStatus: dealerProfile?.status });
    const accessToken = tokenUtils.generateAccessToken(refreshedUser.id, refreshedUser.tokenVersion);
    const refreshToken = tokenUtils.generateRefreshToken(refreshedUser.id, undefined, refreshedUser.tokenVersion);

    return { accessToken, refreshToken, user: { accountReference: toAccountReference(refreshedUser.id), id: refreshedUser.id, name: refreshedUser.name, email: refreshedUser.email, phone: refreshedUser.phone ?? null, role: refreshedUser.role, effectiveRole, avatar: refreshedUser.avatar ?? null, isDealer: !!dealerProfile, dealerStatus: dealerProfile?.status ?? null } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AUTHENTICATED SELF-CHANGE PASSWORD (USER and DEALER only)
  // ─────────────────────────────────────────────────────────────────────────
  //
  // USER and DEALER accounts can change their own password while logged in.
  //
  // ADMIN is explicitly blocked — admin passwords are managed exclusively
  // by a SuperAdmin via PATCH /api/v1/users/:id/admin-password.
  // This prevents a compromised ADMIN session from silently rotating
  // credentials and retaining persistent access.
  //
  // SUPERADMIN can still use this endpoint (they are not blocked).
  // The out-of-band reset (resetSuperAdminPassword) handles their locked-out case.

  async changeOwnPassword(params: { userId: string; currentPassword: string; newPassword: string }): Promise<{ accessToken: string; refreshToken: string }> {
    const userId = params.userId.trim();
    if (!userId) throw new AppError(401, "User not authenticated.");

    const user = await this.authRepository.findUserByIdWithPassword(userId);
    if (!user) throw new AppError(404, "User not found.");

    // ADMIN passwords are managed exclusively by a SuperAdmin.
    // Even a fully compromised ADMIN session cannot change the password here.
    if (user.role === ROLE.ADMIN) {
      throw new AppError(
        403,
        "Admin passwords can only be changed by a SuperAdmin. Ask your SuperAdmin to reset your password via the admin panel."
      );
    }

    if (!user.password || !this.isBcryptHash(user.password)) {
      throw new AppError(400, "Password authentication is not configured for this account. Use OAuth sign-in.");
    }

    const isCurrentPasswordValid = await this.verifyPassword({ userId: user.id, inputPassword: params.currentPassword, storedPassword: user.password });
    if (!isCurrentPasswordValid) throw new AppError(400, "Current password is incorrect.");

    const newPasswordValue = String(params.newPassword ?? "").trim();
    this.assertPasswordStrength(newPasswordValue, "New password");

    const isSamePassword = await passwordUtils.comparePassword(newPasswordValue, user.password);
    if (isSamePassword) throw new AppError(400, "New password must be different from your current password.");

    await this.authRepository.updateUserPassword(userId, newPasswordValue, { invalidateSessions: true });

    const refreshedUser = await this.authRepository.findUserById(userId);
    if (!refreshedUser) throw new AppError(500, "User not found after password update.");

    const accessToken = tokenUtils.generateAccessToken(refreshedUser.id, refreshedUser.tokenVersion);
    const refreshToken = tokenUtils.generateRefreshToken(refreshedUser.id, undefined, refreshedUser.tokenVersion);

    const platformName = getPlatformName();
    const supportEmail = getSupportEmail();
    if (user.email) {
      await sendEmail({
        to: user.email,
        subject: `${platformName} | Your password was changed`,
        text: `Your ${platformName} password was changed. All other sessions have been logged out. If this was not you, contact ${supportEmail} immediately.`,
        html: `<div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6;"><p>Hello <strong>${user.name}</strong>,</p><p>Your <strong>${platformName}</strong> password was changed successfully.</p><p>All other active sessions have been logged out.</p><p>If you did not make this change, contact <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a> immediately.</p></div>`,
      });
    }

    return { accessToken, refreshToken };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUPERADMIN OUT-OF-BAND RESET (compromised SuperAdmin recovery)
  // ─────────────────────────────────────────────────────────────────────────

  async resetSuperAdminPassword(params: { resetSecret: string; targetEmail: string; newPassword: string }): Promise<{ message: string }> {
    const configuredSecret = config.raw.SUPERADMIN_RESET_SECRET;
    if (!configuredSecret || configuredSecret.trim().length < 32) {
      throw new AppError(503, "SuperAdmin password reset is not configured. Set SUPERADMIN_RESET_SECRET in your environment.");
    }

    let secretMatches = false;
    try {
      const providedBuf = Buffer.from(String(params.resetSecret ?? ""), "utf8");
      const expectedBuf = Buffer.from(configuredSecret.trim(), "utf8");
      if (providedBuf.length === expectedBuf.length) secretMatches = crypto.timingSafeEqual(providedBuf, expectedBuf);
    } catch { secretMatches = false; }

    if (!secretMatches) throw new AppError(403, "Invalid reset credentials.");

    const normalizedEmail = this.normalizeEmail(params.targetEmail);
    const user = await this.authRepository.findUserByEmail(normalizedEmail);
    if (!user || user.role !== ROLE.SUPERADMIN) throw new AppError(403, "Invalid reset credentials.");

    const newPasswordValue = String(params.newPassword ?? "").trim();
    this.assertPasswordStrength(newPasswordValue, "New password");
    await this.authRepository.updateUserPassword(user.id, newPasswordValue, { invalidateSessions: true });

    const platformName = getPlatformName();
    const supportEmail = getSupportEmail();
    await sendEmail({
      to: user.email,
      subject: `${platformName} | SuperAdmin Password Reset`,
      text: `Hello ${user.name},\n\nYour ${platformName} SuperAdmin password was reset via the emergency recovery procedure.\nAll active sessions have been logged out.\n\nIf this was not expected, contact ${supportEmail} immediately and rotate the SUPERADMIN_RESET_SECRET.`,
      html: `<div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6;"><p>Hello <strong>${user.name}</strong>,</p><p>Your <strong>${platformName}</strong> SuperAdmin password was reset via the emergency recovery procedure.</p><p>All active sessions have been logged out immediately.</p><p style="color:#dc2626;font-weight:600;">If you did not initiate this, contact <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a> immediately and rotate the SUPERADMIN_RESET_SECRET environment variable.</p></div>`,
    });

    return { message: "SuperAdmin password reset successfully. All sessions invalidated." };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC FORGOT PASSWORD (users and dealers only — NOT admins)
  // ─────────────────────────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<{ message: string }> {
    const normalizedEmail = this.normalizeEmail(email);

    // Always return the same message — prevents email enumeration.
    const SAFE_RESPONSE = { message: "If that email is registered with a user or dealer account, a reset link has been sent." };

    const user = await this.authRepository.findUserByEmail(normalizedEmail);
    if (!user) return SAFE_RESPONSE;

    // Block ADMIN/SUPERADMIN from the unauthenticated public reset path.
    if (PRIVILEGED_ROLES.has(user.role as ROLE)) return SAFE_RESPONSE;

    await this.issuePasswordResetLink({ id: user.id, email: user.email });
    return SAFE_RESPONSE;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC RESET PASSWORD (consumes token from forgotPassword email)
  // ─────────────────────────────────────────────────────────────────────────

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const platformName = getPlatformName();
    const supportEmail = getSupportEmail();

    const user = await this.authRepository.findUserByResetToken(hashedToken);
    if (!user) throw new BadRequestError("Invalid or expired reset token.");

    // Double-check the token belongs to a non-privileged account.
    if (PRIVILEGED_ROLES.has(user.role as ROLE)) {
      await this.authRepository.clearResetToken(user.id);
      throw new AppError(403, "Password reset via this method is not permitted for admin accounts.");
    }

    const newPasswordValue = String(newPassword ?? "").trim();
    this.assertPasswordStrength(newPasswordValue, "New password");
    await this.authRepository.updateUserPassword(user.id, newPasswordValue, { invalidateSessions: true });

    await sendEmail({
      to: user.email,
      subject: `${platformName} | Your password was changed`,
      text: `Your ${platformName} password was changed successfully. All active sessions have been logged out. If this was not you, contact ${supportEmail} immediately.`,
      html: `<div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5;"><p>Hello,</p><p>Your <strong>${platformName}</strong> password was changed successfully.</p><p>All active sessions have been logged out.</p><p>If this was not you, contact <a href="mailto:${supportEmail}">${supportEmail}</a> immediately.</p></div>`,
    });

    return { message: "Password reset successful. You can now sign in." };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SELF-TRIGGERED RESET LINK (authenticated users/dealers, not admins)
  // ─────────────────────────────────────────────────────────────────────────

  async requestOwnPasswordResetLink(userId: string): Promise<{ message: string }> {
    const normalizedUserId = userId.trim();
    const user = await this.authRepository.findUserById(normalizedUserId);
    if (!user) throw new AppError(404, "User not found.");
    if (PRIVILEGED_ROLES.has(user.role as ROLE)) {
      throw new AppError(403, "Admin accounts cannot use the email-based reset flow. Use the change-password option from your admin panel instead.");
    }
    await this.issuePasswordResetLink({ id: user.id, email: user.email });
    return { message: "Password reset link sent to your registered email address." };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REFRESH TOKEN
  // ─────────────────────────────────────────────────────────────────────────

  async refreshToken(oldRefreshToken: string): Promise<{
    user: { id: string; accountReference: string; name: string; email: string; phone: string | null; role: string; effectiveRole?: "USER" | "DEALER" | "ADMIN" | "SUPERADMIN"; avatar: string | null; isDealer?: boolean; dealerStatus?: "PENDING" | "APPROVED" | "LEGACY" | "REJECTED" | "SUSPENDED" | null; dealerBusinessName?: string | null; dealerContactPhone?: string | null };
    newAccessToken: string;
    newRefreshToken: string;
  }> {
    if (await tokenUtils.isTokenBlacklisted(oldRefreshToken)) throw new NotFoundError("Refresh token");

    const decoded = jwt.verify(oldRefreshToken, config.auth.refreshTokenSecret) as { id: string; absExp: number; tv?: number };
    const absoluteExpiration = decoded.absExp;
    const now = Math.floor(Date.now() / 1000);
    if (now > absoluteExpiration) throw new AppError(401, "Session expired. Please log in again.");

    const user = await this.authRepository.findUserById(decoded.id);
    if (!user) throw new NotFoundError("User");

    const refreshTokenVersion = typeof decoded.tv === "number" ? decoded.tv : 0;
    if (refreshTokenVersion !== user.tokenVersion) throw new AppError(401, "Session expired. Please log in again.");

    const effectiveRole = resolveEffectiveRole({ role: user.role, dealerStatus: user.dealerProfile?.status });
    if (effectiveRole === "DEALER") {
      if (!user.dealerProfile) throw new AppError(403, "Dealer profile is missing. Please contact admin support.");
      const approvedStatuses = new Set(["APPROVED", "LEGACY"]);
      if (!approvedStatuses.has(user.dealerProfile.status)) {
        if (user.dealerProfile.status === "SUSPENDED") throw new AppError(403, "Dealer account is suspended. Please contact admin support.");
        throw new AppError(403, "Dealer access is currently restricted. Please contact admin support.");
      }
    }

    const normalizedUser = { id: user.id, accountReference: toAccountReference(user.id), name: user.name, email: user.email, phone: user.phone ?? null, role: user.role, effectiveRole, avatar: user.avatar, isDealer: !!user.dealerProfile, dealerStatus: user.dealerProfile?.status ?? null, dealerBusinessName: user.dealerProfile?.businessName ?? null, dealerContactPhone: user.dealerProfile?.contactPhone ?? null };

    const newAccessToken = tokenUtils.generateAccessToken(user.id, user.tokenVersion);
    const newRefreshToken = tokenUtils.generateRefreshToken(user.id, absoluteExpiration, user.tokenVersion);

    const oldTokenTTL = absoluteExpiration - now;
    if (oldTokenTTL > 0) {
      await tokenUtils.blacklistToken(oldRefreshToken, oldTokenTTL);
    } else {
      logger.warn("Refresh token is already expired. No need to blacklist.");
    }

    return { user: normalizedUser, newAccessToken, newRefreshToken };
  }
}
