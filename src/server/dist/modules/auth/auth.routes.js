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
const express_1 = __importDefault(require("express"));
const auth_factory_1 = require("./auth.factory");
const passport_1 = __importDefault(require("passport"));
const constants_1 = require("@/shared/constants");
const handleSocialLogin_1 = __importDefault(require("@/shared/utils/auth/handleSocialLogin"));
const AppError_1 = __importDefault(require("@/shared/errors/AppError"));
const optionalAuth_1 = __importDefault(require("@/shared/middlewares/optionalAuth"));
const rateLimiter_1 = require("@/shared/middlewares/rateLimiter");
const validateDto_1 = require("@/shared/middlewares/validateDto");
const auth_dto_1 = require("./auth.dto");
const config_1 = require("@/config");
const router = express_1.default.Router();
const authController = (0, auth_factory_1.makeAuthController)();
const env = config_1.config.nodeEnv;
const clientRedirectUrl = env === "production" ? config_1.config.urls.clientProd : config_1.config.urls.clientDev;
if (!clientRedirectUrl) {
    throw new Error("CLIENT_URL_DEV/CLIENT_URL_PROD must be configured.");
}
const isConfigured = (...values) => values.every((value) => value && value.trim() !== "" && value.trim().toLowerCase() !== "dummy");
const isProviderConfigured = (provider) => {
    const isProd = env === "production";
    if (provider === "google") {
        return isConfigured(config_1.config.raw.GOOGLE_CLIENT_ID, config_1.config.raw.GOOGLE_CLIENT_SECRET, isProd ? config_1.config.raw.GOOGLE_CALLBACK_URL_PROD : config_1.config.raw.GOOGLE_CALLBACK_URL_DEV);
    }
    if (provider === "facebook") {
        return isConfigured(config_1.config.raw.FACEBOOK_APP_ID, config_1.config.raw.FACEBOOK_APP_SECRET, isProd
            ? config_1.config.raw.FACEBOOK_CALLBACK_URL_PROD
            : config_1.config.raw.FACEBOOK_CALLBACK_URL_DEV);
    }
    return isConfigured(config_1.config.raw.TWITTER_CONSUMER_KEY, config_1.config.raw.TWITTER_CONSUMER_SECRET, isProd ? config_1.config.raw.TWITTER_CALLBACK_URL_PROD : config_1.config.raw.TWITTER_CALLBACK_URL_DEV);
};
const ensureProviderEnabled = (provider) => (req, res, next) => {
    if (!isProviderConfigured(provider)) {
        next(new AppError_1.default(503, `${provider} OAuth is not configured.`));
        return;
    }
    next();
};
/**
 * @swagger
 * /google:
 *   get:
 *     summary: Redirect to Google for authentication
 *     description: Initiates the OAuth flow for Google login.
 *     responses:
 *       302:
 *         description: Redirect to Google login page.
 */
router.get("/google", ensureProviderEnabled("google"), (0, handleSocialLogin_1.default)("google"));
router.get("/google/callback", passport_1.default.authenticate("google", {
    session: false,
    failureRedirect: clientRedirectUrl,
}), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { accessToken, refreshToken } = user;
    res.cookie("refreshToken", refreshToken, constants_1.cookieOptions);
    res.cookie("accessToken", accessToken, constants_1.cookieOptions);
    res.redirect(clientRedirectUrl);
}));
/**
 * @swagger
 * /google/callback:
 *   get:
 *     summary: Handle callback from Google OAuth
 *     description: Handles the response from Google after OAuth authentication is complete.
 *     responses:
 *       200:
 *         description: Successfully authenticated with Google.
 */
/**
 * @swagger
 * /facebook:
 *   get:
 *     summary: Redirect to Facebook for authentication
 *     description: Initiates the OAuth flow for Facebook login.
 *     responses:
 *       302:
 *         description: Redirect to Facebook login page.
 */
router.get("/facebook", ensureProviderEnabled("facebook"), (0, handleSocialLogin_1.default)("facebook"));
router.get("/facebook/callback", passport_1.default.authenticate("facebook", {
    session: false,
    failureRedirect: clientRedirectUrl,
}), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { accessToken, refreshToken } = user;
    res.cookie("refreshToken", refreshToken, constants_1.cookieOptions);
    res.cookie("accessToken", accessToken, constants_1.cookieOptions);
    res.redirect(clientRedirectUrl);
}));
/**
 * @swagger
 * /facebook/callback:
 *   get:
 *     summary: Handle callback from Facebook OAuth
 *     description: Handles the response from Facebook after OAuth authentication is complete.
 *     responses:
 *       200:
 *         description: Successfully authenticated with Facebook.
 */
/**
 * @swagger
 * /twitter:
 *   get:
 *     summary: Redirect to Twitter for authentication
 *     description: Initiates the OAuth flow for Twitter login.
 *     responses:
 *       302:
 *         description: Redirect to Twitter login page.
 */
router.get("/twitter", ensureProviderEnabled("twitter"), passport_1.default.authenticate("twitter", {
    session: false,
    scope: ["email"],
}));
router.get("/twitter/callback", passport_1.default.authenticate("twitter", {
    session: false,
    failureRedirect: `${clientRedirectUrl}?error=auth_failed`,
}), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { accessToken, refreshToken } = user;
    res.cookie("refreshToken", refreshToken, constants_1.cookieOptions);
    res.cookie("accessToken", accessToken, constants_1.cookieOptions);
    res.redirect(clientRedirectUrl);
}));
/**
 * @swagger
 * /twitter/callback:
 *   get:
 *     summary: Handle callback from Twitter OAuth
 *     description: Handles the response from Twitter after OAuth authentication is complete.
 *     responses:
 *       200:
 *         description: Successfully authenticated with Twitter.
 */
/**
 * @swagger
 * /request-registration-otp:
 *   post:
 *     summary: Request registration OTP
 *     description: Sends an email OTP for account/dealer registration verification.
 *     responses:
 *       200:
 *         description: OTP sent successfully.
 */
router.post("/request-registration-otp", rateLimiter_1.otpRateLimiter, (0, validateDto_1.validateDto)(auth_dto_1.RequestRegistrationOtpDto), authController.requestRegistrationOtp);
/**
 * @swagger
 * /sign-up:
 *   post:
 *     summary: User sign-up
 *     description: Allows a new user to register by providing necessary details.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: User's email address.
 *               password:
 *                 type: string
 *                 description: User's password.
 *               fullName:
 *                 type: string
 *                 description: User's full name.
 *     responses:
 *       201:
 *         description: User successfully created.
 */
router.post("/sign-up", rateLimiter_1.registrationLimiter, (0, validateDto_1.validateDto)(auth_dto_1.RegisterDto), authController.signup);
/**
 * @swagger
 * /verify-email:
 *   post:
 *     summary: Verify email address
 *     description: Sends a verification email to the user to confirm their email address.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The email address of the user to verify.
 *     responses:
 *       200:
 *         description: Email verification sent.
 */
/**
 * @swagger
 * /verification-email/{email}:
 *   get:
 *     summary: Resend verification email
 *     description: Resends the verification email to a given address.
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: The email address of the user who needs a verification email.
 *     responses:
 *       200:
 *         description: Verification email resent.
 */
/**
 * @swagger
 * /sign-in:
 *   post:
 *     summary: User sign-in
 *     description: Allows an existing user to sign in using their credentials.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: User's email address.
 *               password:
 *                 type: string
 *                 description: User's password.
 *     responses:
 *       200:
 *         description: User successfully signed in.
 */
router.post("/sign-in", rateLimiter_1.authRateLimiter, (0, validateDto_1.validateDto)(auth_dto_1.SigninDto), authController.signin);
/**
 * @swagger
 * /refresh-token:
 *   post:
 *     summary: Refresh authentication token
 *     description: Allows a user to refresh their authentication token when it expires.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token to obtain a new access token.
 *     responses:
 *       200:
 *         description: Successfully refreshed the token.
 */
router.post("/refresh-token", authController.refreshToken);
/**
 * @swagger
 * /forgot-password:
 *   post:
 *     summary: Forgot password
 *     description: Sends a password reset email to the user who has forgotten their password.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The user's email address to receive the password reset link.
 *     responses:
 *       200:
 *         description: Password reset email sent.
 */
router.post("/forgot-password", rateLimiter_1.passwordResetLimiter, (0, validateDto_1.validateDto)(auth_dto_1.ForgotPasswordDto), authController.forgotPassword);
/**
 * @swagger
 * /reset-password:
 *   post:
 *     summary: Reset password
 *     description: Allows a user to reset their password using a reset token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 description: The token used for resetting the password.
 *               newPassword:
 *                 type: string
 *                 description: The new password to be set for the user.
 *     responses:
 *       200:
 *         description: Password successfully reset.
 */
router.post("/reset-password", rateLimiter_1.passwordResetLimiter, (0, validateDto_1.validateDto)(auth_dto_1.ResetPasswordDto), authController.resetPassword);
/**
 * @swagger
 * /sign-out:
 *   get:
 *     summary: User sign-out
 *     description: Logs the user out of the application by invalidating their session.
 *     responses:
 *       200:
 *         description: User successfully signed out.
 */
router.get("/sign-out", optionalAuth_1.default, authController.signout);
exports.default = router;
