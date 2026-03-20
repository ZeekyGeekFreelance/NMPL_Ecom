import express from "express";
import { makeAuthController } from "./auth.factory";
import { cookieOptions } from "@/shared/constants";
import AppError from "@/shared/errors/AppError";
import optionalAuth from "@/shared/middlewares/optionalAuth";
import protect from "@/shared/middlewares/protect";
import csrfProtection from "@/shared/middlewares/csrfProtection";
import {
  authRateLimiter,
  changePasswordLimiter,
  otpRateLimiter,
  passwordResetLimiter,
  refreshTokenLimiter,
  registrationLimiter,
  superAdminResetLimiter,
} from "@/shared/middlewares/rateLimiter";
import { validateDto } from "@/shared/middlewares/validateDto";
import {
  ApplyDealerAccessDto,
  ChangePasswordOnFirstLoginDto,
  ChangeOwnPasswordDto,
  RegisterDto,
  RequestRegistrationOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  SigninDto,
  SuperAdminResetPasswordDto,
} from "./auth.dto";
import { config } from "@/config";

const router = express.Router();
const authController = makeAuthController();
const env = config.nodeEnv;
const clientRedirectUrl =
  env === "production" ? config.urls.clientProd : config.urls.clientDev;

if (!clientRedirectUrl) {
  throw new Error("CLIENT_URL_DEV/CLIENT_URL_PROD must be configured.");
}

// ── Registration ──────────────────────────────────────────────────────────
router.post(
  "/request-registration-otp",
  otpRateLimiter,
  validateDto(RequestRegistrationOtpDto),
  authController.requestRegistrationOtp
);

router.post(
  "/sign-up",
  registrationLimiter,
  validateDto(RegisterDto),
  authController.signup
);

router.post(
  "/dealer/apply",
  protect,
  csrfProtection,
  validateDto(ApplyDealerAccessDto),
  authController.applyDealerAccess
);

// ── Sign in / out / refresh ───────────────────────────────────────────────
router.post(
  "/sign-in",
  authRateLimiter,
  validateDto(SigninDto),
  authController.signin
);

router.get("/sign-out", optionalAuth, authController.signout);

router.post(
  "/refresh-token",
  refreshTokenLimiter,
  authController.refreshToken
);

// ── Forced first-login password change (legacy dealers) ───────────────────
// Unauthenticated — user provides email + temp password + new password.
router.post(
  "/change-password",
  authRateLimiter,
  validateDto(ChangePasswordOnFirstLoginDto),
  authController.changePasswordOnFirstLogin
);

// ── Authenticated self-service password change (ALL roles) ───────────────
// Requires a valid session. Works for USER, DEALER, ADMIN, and SUPERADMIN.
// This is the ONLY self-service password change path for admin accounts.
router.post(
  "/change-own-password",
  protect,                      // must be logged in
  changePasswordLimiter,        // 5 attempts per 15 min per IP+email
  csrfProtection,
  validateDto(ChangeOwnPasswordDto),
  authController.changeOwnPassword
);

// ── Public forgot / reset (USER and DEALER only — admins are blocked) ─────
router.post(
  "/forgot-password",
  passwordResetLimiter,
  validateDto(ForgotPasswordDto),
  authController.forgotPassword
);

router.post(
  "/reset-password",
  passwordResetLimiter,
  validateDto(ResetPasswordDto),
  authController.resetPassword
);

// ── SuperAdmin out-of-band emergency reset ────────────────────────────────
// Unauthenticated but protected by SUPERADMIN_RESET_SECRET (shared secret).
// Used ONLY when a SuperAdmin cannot sign in (compromised / forgotten password).
// Rate-limited to 5 req/hour per IP. In production, restrict this path to
// known IPs in nginx for an additional layer of protection.
router.post(
  "/superadmin/reset-password",
  superAdminResetLimiter,
  validateDto(SuperAdminResetPasswordDto),
  authController.resetSuperAdminPassword
);

export default router;
