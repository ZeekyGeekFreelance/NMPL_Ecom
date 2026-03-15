import express from "express";
import { makeAuthController } from "./auth.factory";
import passport from "passport";
import { cookieOptions } from "@/shared/constants";
import handleSocialLogin from "@/shared/utils/auth/handleSocialLogin";
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

const isConfigured = (...values: Array<string | undefined>) =>
  values.every(
    (v) => v && v.trim() !== "" && v.trim().toLowerCase() !== "dummy"
  );

const isProviderConfigured = (provider: "google" | "facebook" | "twitter") => {
  const isProd = env === "production";
  if (provider === "google") {
    return isConfigured(
      config.raw.GOOGLE_CLIENT_ID,
      config.raw.GOOGLE_CLIENT_SECRET,
      isProd ? config.raw.GOOGLE_CALLBACK_URL_PROD : config.raw.GOOGLE_CALLBACK_URL_DEV
    );
  }
  if (provider === "facebook") {
    return isConfigured(
      config.raw.FACEBOOK_APP_ID,
      config.raw.FACEBOOK_APP_SECRET,
      isProd ? config.raw.FACEBOOK_CALLBACK_URL_PROD : config.raw.FACEBOOK_CALLBACK_URL_DEV
    );
  }
  return isConfigured(
    config.raw.TWITTER_CONSUMER_KEY,
    config.raw.TWITTER_CONSUMER_SECRET,
    isProd ? config.raw.TWITTER_CALLBACK_URL_PROD : config.raw.TWITTER_CALLBACK_URL_DEV
  );
};

const ensureProviderEnabled =
  (provider: "google" | "facebook" | "twitter") =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!isProviderConfigured(provider)) {
      next(new AppError(503, `${provider} OAuth is not configured.`));
      return;
    }
    next();
  };

// ── OAuth ─────────────────────────────────────────────────────────────────
router.get("/google", ensureProviderEnabled("google"), handleSocialLogin("google"));
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: clientRedirectUrl }),
  async (req: any, res: any) => {
    res.cookie("refreshToken", req.user.refreshToken, cookieOptions);
    res.cookie("accessToken", req.user.accessToken, cookieOptions);
    res.redirect(clientRedirectUrl);
  }
);

router.get("/facebook", ensureProviderEnabled("facebook"), handleSocialLogin("facebook"));
router.get(
  "/facebook/callback",
  passport.authenticate("facebook", { session: false, failureRedirect: clientRedirectUrl }),
  async (req: any, res: any) => {
    res.cookie("refreshToken", req.user.refreshToken, cookieOptions);
    res.cookie("accessToken", req.user.accessToken, cookieOptions);
    res.redirect(clientRedirectUrl);
  }
);

router.get(
  "/twitter",
  ensureProviderEnabled("twitter"),
  passport.authenticate("twitter", { session: false, scope: ["email"] })
);
router.get(
  "/twitter/callback",
  passport.authenticate("twitter", {
    session: false,
    failureRedirect: `${clientRedirectUrl}?error=auth_failed`,
  }),
  async (req: any, res: any) => {
    res.cookie("refreshToken", req.user.refreshToken, cookieOptions);
    res.cookie("accessToken", req.user.accessToken, cookieOptions);
    res.redirect(clientRedirectUrl);
  }
);

// ── Registration ──────────────────────────────────────────────────────────
router.post(
  "/request-registration-otp",
  otpRateLimiter,
  csrfProtection,
  validateDto(RequestRegistrationOtpDto),
  authController.requestRegistrationOtp
);

router.post(
  "/sign-up",
  registrationLimiter,
  csrfProtection,
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
  csrfProtection,
  validateDto(SigninDto),
  authController.signin
);

router.get("/sign-out", optionalAuth, authController.signout);

router.post(
  "/refresh-token",
  refreshTokenLimiter,
  csrfProtection,
  authController.refreshToken
);

// ── Forced first-login password change (legacy dealers) ───────────────────
// Unauthenticated — user provides email + temp password + new password.
router.post(
  "/change-password",
  authRateLimiter,
  csrfProtection,
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
  csrfProtection,
  validateDto(ForgotPasswordDto),
  authController.forgotPassword
);

router.post(
  "/reset-password",
  passwordResetLimiter,
  csrfProtection,
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
  csrfProtection,
  validateDto(SuperAdminResetPasswordDto),
  authController.resetSuperAdminPassword
);

export default router;
