"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const AppError_1 = __importDefault(require("@/shared/errors/AppError"));
const sendEmail_1 = __importDefault(require("@/shared/utils/sendEmail"));
const passwordReset_1 = __importDefault(require("@/shared/templates/passwordReset"));
const registrationOtp_1 = __importDefault(require("@/shared/templates/registrationOtp"));
const authUtils_1 = require("@/shared/utils/authUtils");
const client_1 = require("@prisma/client");
const logger_1 = __importDefault(require("@/infra/winston/logger"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const BadRequestError_1 = __importDefault(require("@/shared/errors/BadRequestError"));
const NotFoundError_1 = __importDefault(require("@/shared/errors/NotFoundError"));
const accountReference_1 = require("@/shared/utils/accountReference");
const branding_1 = require("@/shared/utils/branding");
const registrationOtp_2 = require("@/shared/utils/auth/registrationOtp");
const resolveClientUrl = () => {
    return (process.env.CLIENT_URL ||
        process.env.CLIENT_URL_DEV ||
        process.env.CLIENT_URL_PROD ||
        "");
};
const resolveNotificationRecipients = () => {
    return (process.env.BILLING_NOTIFICATION_EMAILS || "")
        .split(",")
        .map((email) => email.trim())
        .filter(Boolean)
        .join(",");
};
class AuthService {
    constructor(authRepository, dealerNotificationService) {
        this.authRepository = authRepository;
        this.dealerNotificationService = dealerNotificationService;
    }
    normalizeEmail(email) {
        return email.trim().toLowerCase();
    }
    isBcryptHash(password) {
        return /^\$2[aby]\$\d{2}\$/.test(password);
    }
    verifyPassword(_a) {
        return __awaiter(this, arguments, void 0, function* ({ userId, inputPassword, storedPassword, }) {
            if (this.isBcryptHash(storedPassword)) {
                return authUtils_1.passwordUtils.comparePassword(inputPassword, storedPassword);
            }
            if (storedPassword === inputPassword) {
                // Upgrade legacy plain-text passwords after first successful login.
                yield this.authRepository.updateUserPassword(userId, inputPassword);
                return true;
            }
            return false;
        });
    }
    requestRegistrationOtp(_a) {
        return __awaiter(this, arguments, void 0, function* ({ email, purpose = "USER_PORTAL", requestDealerAccess = false, }) {
            const normalizedEmail = email.trim().toLowerCase();
            const existingUser = yield this.authRepository.findUserByEmail(normalizedEmail);
            if (existingUser) {
                throw new BadRequestError_1.default("This email is already registered. Please sign in instead.");
            }
            let otpDetails;
            try {
                otpDetails = yield (0, registrationOtp_2.createRegistrationOtp)({
                    email: normalizedEmail,
                    purpose,
                    requestDealerAccess,
                });
            }
            catch (error) {
                if (error instanceof registrationOtp_2.RegistrationOtpRateLimitError) {
                    throw new BadRequestError_1.default(`OTP already sent. Please wait ${error.retryAfterSeconds} seconds before requesting a new one.`);
                }
                throw new AppError_1.default(500, "Unable to prepare registration OTP. Please try again in a moment.");
            }
            const { otpCode, expiresInSeconds, resendAvailableInSeconds } = otpDetails;
            const purposeLabel = purpose === "DEALER_PORTAL" ? "Dealer Registration" : "Account Registration";
            const platformName = (0, branding_1.getPlatformName)();
            const supportEmail = (0, branding_1.getSupportEmail)();
            const otpTemplate = (0, registrationOtp_1.default)({
                platformName,
                otpCode,
                purposeLabel,
                expiresInMinutes: Math.floor(expiresInSeconds / 60),
                supportEmail,
            });
            const sent = yield (0, sendEmail_1.default)({
                to: normalizedEmail,
                subject: otpTemplate.subject,
                text: otpTemplate.text,
                html: otpTemplate.html,
            });
            if (!sent) {
                yield (0, registrationOtp_2.clearRegistrationOtp)(normalizedEmail);
                throw new AppError_1.default(500, "Failed to send OTP email. Please try again in a moment.");
            }
            return {
                message: `OTP sent successfully. It will expire in ${Math.floor(expiresInSeconds / 60)} minutes.`,
                resendAvailableInSeconds,
            };
        });
    }
    registerUser(_a) {
        return __awaiter(this, arguments, void 0, function* ({ name, email, phone, password, otpCode, requestDealerAccess = false, businessName, contactPhone, }) {
            var _b, _c, _d, _e, _f;
            const normalizedEmail = email.trim().toLowerCase();
            const normalizedPhone = String(phone !== null && phone !== void 0 ? phone : "").trim();
            const existingUser = yield this.authRepository.findUserByEmail(normalizedEmail);
            if (existingUser) {
                throw new AppError_1.default(400, "This email is already registered, please log in instead.");
            }
            if (!normalizedPhone) {
                throw new BadRequestError_1.default("Phone number is required.");
            }
            if (!otpCode || !otpCode.trim()) {
                throw new BadRequestError_1.default("Registration OTP is required. Please use the OTP sent to your email.");
            }
            const otpVerification = yield (0, registrationOtp_2.verifyAndConsumeRegistrationOtp)(normalizedEmail, otpCode);
            if (otpVerification.status === "EXPIRED") {
                throw new BadRequestError_1.default("Registration OTP expired. Request a new OTP and try again.");
            }
            if (otpVerification.status === "LOCKED") {
                throw new BadRequestError_1.default("Too many incorrect OTP attempts. Please request a new OTP.");
            }
            if (otpVerification.status === "INVALID") {
                throw new BadRequestError_1.default(`Invalid registration OTP code. ${otpVerification.attemptsRemaining} attempt(s) remaining.`);
            }
            const otpContext = otpVerification.context;
            const shouldRequestDealerAccess = otpContext.requestDealerAccess === true;
            const normalizedDealerContactPhone = (contactPhone === null || contactPhone === void 0 ? void 0 : contactPhone.trim()) || normalizedPhone;
            if (requestDealerAccess && !shouldRequestDealerAccess) {
                throw new BadRequestError_1.default("Dealer signup requires an OTP requested from the dealer registration flow.");
            }
            // Registrations created through this flow always start as USER role.
            const newUser = yield this.authRepository.createUser({
                email: normalizedEmail,
                phone: normalizedPhone,
                name,
                password,
                role: client_1.ROLE.USER,
            });
            const accountReference = (0, accountReference_1.toAccountReference)(newUser.id);
            const adminsEmail = resolveNotificationRecipients();
            if (shouldRequestDealerAccess) {
                const dealerProfile = yield this.authRepository.upsertDealerProfile({
                    userId: newUser.id,
                    businessName: businessName !== null && businessName !== void 0 ? businessName : null,
                    contactPhone: normalizedDealerContactPhone,
                    status: "PENDING",
                    approvedBy: null,
                });
                yield ((_b = this.dealerNotificationService) === null || _b === void 0 ? void 0 : _b.sendDealerApplicationSubmitted({
                    recipientName: newUser.name,
                    recipientEmail: newUser.email,
                    businessName: (_c = dealerProfile === null || dealerProfile === void 0 ? void 0 : dealerProfile.businessName) !== null && _c !== void 0 ? _c : null,
                    accountReference,
                }));
                if (adminsEmail) {
                    yield (0, sendEmail_1.default)({
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
                        avatar: null,
                        isDealer: true,
                        dealerStatus: (_d = dealerProfile === null || dealerProfile === void 0 ? void 0 : dealerProfile.status) !== null && _d !== void 0 ? _d : "PENDING",
                        dealerBusinessName: (_e = dealerProfile === null || dealerProfile === void 0 ? void 0 : dealerProfile.businessName) !== null && _e !== void 0 ? _e : null,
                        dealerContactPhone: (_f = dealerProfile === null || dealerProfile === void 0 ? void 0 : dealerProfile.contactPhone) !== null && _f !== void 0 ? _f : null,
                    },
                    requiresApproval: true,
                };
            }
            const accessToken = authUtils_1.tokenUtils.generateAccessToken(newUser.id);
            const refreshToken = authUtils_1.tokenUtils.generateRefreshToken(newUser.id);
            return {
                user: {
                    id: newUser.id,
                    accountReference,
                    name: newUser.name,
                    email: newUser.email,
                    phone: newUser.phone,
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
        });
    }
    signin(_a) {
        return __awaiter(this, arguments, void 0, function* ({ email, password }) {
            var _b, _c, _d;
            const normalizedEmail = this.normalizeEmail(email);
            const user = yield this.authRepository.findUserByEmailWithPassword(normalizedEmail);
            if (!user) {
                throw new BadRequestError_1.default("Email or password is incorrect.");
            }
            if (!user.password) {
                throw new AppError_1.default(400, "Email or password is incorrect.");
            }
            const isPasswordValid = yield this.verifyPassword({
                userId: user.id,
                inputPassword: password,
                storedPassword: user.password,
            });
            if (!isPasswordValid) {
                throw new AppError_1.default(400, "Email or password is incorrect.");
            }
            const dealerProfile = yield this.authRepository.findDealerProfileByUserId(user.id);
            if (dealerProfile && dealerProfile.status !== "APPROVED") {
                if (dealerProfile.status === "PENDING") {
                    throw new AppError_1.default(403, "Dealer account is pending admin approval. Please wait for confirmation.");
                }
                throw new AppError_1.default(403, "Dealer access is currently restricted. Please contact admin support.");
            }
            const accessToken = authUtils_1.tokenUtils.generateAccessToken(user.id);
            const refreshToken = authUtils_1.tokenUtils.generateRefreshToken(user.id);
            return {
                accessToken,
                refreshToken,
                user: Object.assign(Object.assign({ accountReference: (0, accountReference_1.toAccountReference)(user.id) }, user), { isDealer: !!dealerProfile, dealerStatus: (_b = dealerProfile === null || dealerProfile === void 0 ? void 0 : dealerProfile.status) !== null && _b !== void 0 ? _b : null, dealerBusinessName: (_c = dealerProfile === null || dealerProfile === void 0 ? void 0 : dealerProfile.businessName) !== null && _c !== void 0 ? _c : null, dealerContactPhone: (_d = dealerProfile === null || dealerProfile === void 0 ? void 0 : dealerProfile.contactPhone) !== null && _d !== void 0 ? _d : null }),
            };
        });
    }
    signout() {
        return __awaiter(this, void 0, void 0, function* () {
            return { message: "User logged out successfully" };
        });
    }
    forgotPassword(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const normalizedEmail = this.normalizeEmail(email);
            const user = yield this.authRepository.findUserByEmail(normalizedEmail);
            const platformName = (0, branding_1.getPlatformName)();
            const supportEmail = (0, branding_1.getSupportEmail)();
            const successResponse = {
                message: `If an account exists for this email, a ${platformName} password reset link has been sent.`,
            };
            if (!user) {
                // Avoid email enumeration.
                return successResponse;
            }
            const resetToken = crypto_1.default.randomBytes(32).toString("hex");
            const hashedToken = crypto_1.default
                .createHash("sha256")
                .update(resetToken)
                .digest("hex");
            yield this.authRepository.updateUserPasswordReset(normalizedEmail, {
                resetPasswordToken: hashedToken,
                resetPasswordTokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
            });
            const clientUrl = resolveClientUrl();
            const resetUrl = `${clientUrl}/password-reset/${resetToken}`;
            const htmlTemplate = (0, passwordReset_1.default)(resetUrl);
            yield (0, sendEmail_1.default)({
                to: user.email,
                subject: "Reset your password",
                html: htmlTemplate,
                text: "Reset your password",
            });
            return { message: "Password reset email sent successfully" };
        });
    }
    resetPassword(token, newPassword) {
        return __awaiter(this, void 0, void 0, function* () {
            const hashedToken = crypto_1.default.createHash("sha256").update(token).digest("hex");
            const platformName = (0, branding_1.getPlatformName)();
            const supportEmail = (0, branding_1.getSupportEmail)();
            const user = yield this.authRepository.findUserByResetToken(hashedToken);
            if (!user) {
                throw new BadRequestError_1.default("Invalid or expired reset token");
            }
            yield this.authRepository.updateUserPassword(user.id, newPassword);
            yield (0, sendEmail_1.default)({
                to: user.email,
                subject: `${platformName} | Your password was changed`,
                text: `Your ${platformName} account password was changed successfully. If this was not you, contact ${supportEmail} immediately.`,
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
        });
    }
    refreshToken(oldRefreshToken) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g;
            if (yield authUtils_1.tokenUtils.isTokenBlacklisted(oldRefreshToken)) {
                throw new NotFoundError_1.default("Refresh token");
            }
            const refreshSecret = process.env.REFRESH_TOKEN_SECRET;
            if (!refreshSecret) {
                throw new AppError_1.default(500, "Refresh token secret is not configured.");
            }
            const decoded = jsonwebtoken_1.default.verify(oldRefreshToken, refreshSecret);
            const absoluteExpiration = decoded.absExp;
            const now = Math.floor(Date.now() / 1000);
            if (now > absoluteExpiration) {
                throw new AppError_1.default(401, "Session expired. Please log in again.");
            }
            const user = yield this.authRepository.findUserById(decoded.id);
            if (!user) {
                throw new NotFoundError_1.default("User");
            }
            if (user.dealerProfile && user.dealerProfile.status !== "APPROVED") {
                if (user.dealerProfile.status === "PENDING") {
                    throw new AppError_1.default(403, "Dealer account is pending admin approval. Please wait for confirmation.");
                }
                throw new AppError_1.default(403, "Dealer access is currently restricted. Please contact admin support.");
            }
            const normalizedUser = {
                id: user.id,
                accountReference: (0, accountReference_1.toAccountReference)(user.id),
                name: user.name,
                email: user.email,
                phone: (_a = user.phone) !== null && _a !== void 0 ? _a : null,
                role: user.role,
                avatar: user.avatar,
                isDealer: !!user.dealerProfile,
                dealerStatus: (_c = (_b = user.dealerProfile) === null || _b === void 0 ? void 0 : _b.status) !== null && _c !== void 0 ? _c : null,
                dealerBusinessName: (_e = (_d = user.dealerProfile) === null || _d === void 0 ? void 0 : _d.businessName) !== null && _e !== void 0 ? _e : null,
                dealerContactPhone: (_g = (_f = user.dealerProfile) === null || _f === void 0 ? void 0 : _f.contactPhone) !== null && _g !== void 0 ? _g : null,
            };
            const newAccessToken = authUtils_1.tokenUtils.generateAccessToken(user.id);
            const newRefreshToken = authUtils_1.tokenUtils.generateRefreshToken(user.id, absoluteExpiration);
            const oldTokenTTL = absoluteExpiration - now;
            if (oldTokenTTL > 0) {
                yield authUtils_1.tokenUtils.blacklistToken(oldRefreshToken, oldTokenTTL);
            }
            else {
                logger_1.default.warn("Refresh token is already expired. No need to blacklist.");
            }
            return { user: normalizedUser, newAccessToken, newRefreshToken };
        });
    }
}
exports.AuthService = AuthService;
