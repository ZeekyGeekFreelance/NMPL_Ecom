import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { cookieOptions } from "@/shared/constants";
import asyncHandler from "@/shared/utils/asyncHandler";
import sendResponse from "@/shared/utils/sendResponse";
import { AuthService } from "./auth.service";
import { tokenUtils } from "@/shared/utils/authUtils";
import AppError from "@/shared/errors/AppError";
import { CartService } from "../cart/cart.service";
import { makeLogsService } from "../logs/logs.factory";
import { config } from "@/config";
import { rotateCsrfToken } from "@/shared/middlewares/csrfProtection";

const { ...clearCookieOptions } = cookieOptions;

export class AuthController {
  private logsService = makeLogsService();
  constructor(
    private authService: AuthService,
    private cartService?: CartService
  ) {}

  requestRegistrationOtp = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { email, phone, purpose, requestDealerAccess } = req.body;
      const response = await this.authService.requestRegistrationOtp({
        email, phone, purpose, requestDealerAccess,
      });
      sendResponse(res, 200, {
        message: response.message,
        data: { resendAvailableInSeconds: response.resendAvailableInSeconds },
      });
    }
  );

  signup = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const start = Date.now();
    const {
      name, email, phone, password, emailOtpCode, phoneOtpCode,
      requestDealerAccess, businessName, contactPhone,
    } = req.body;
    const { user, accessToken, refreshToken, requiresApproval } =
      await this.authService.registerUser({
        name, email, phone, password, emailOtpCode, phoneOtpCode,
        requestDealerAccess, businessName, contactPhone,
      });

    if (accessToken && refreshToken) {
      res.cookie("refreshToken", refreshToken, cookieOptions);
      res.cookie("accessToken", accessToken, cookieOptions);
      rotateCsrfToken(res);
    }

    sendResponse(res, 201, {
      message: requiresApproval
        ? "Dealer registration submitted. Await admin approval before sign in."
        : "User registered successfully",
      data: {
        user: {
          id: user.id,
          accountReference: user.accountReference,
          name: user.name,
          email: user.email,
          phone: user.phone || null,
          role: user.role,
          effectiveRole: user.effectiveRole || user.role,
          avatar: user.avatar || null,
          isDealer: user.isDealer || false,
          dealerStatus: user.dealerStatus || null,
          dealerBusinessName: user.dealerBusinessName || null,
          dealerContactPhone: user.dealerContactPhone || null,
        },
        requiresApproval: requiresApproval || false,
      },
    });

    this.logsService.info("Register", {
      userId: user.id,
      sessionId: req.session.id,
      timePeriod: Date.now() - start,
    });
  });

  applyDealerAccess = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const currentUserId = req.user?.id;
      if (!currentUserId) throw new AppError(401, "User not authenticated");

      const { businessName, contactPhone } = req.body as {
        businessName?: string;
        contactPhone?: string;
      };

      const { user, wasResubmission } =
        await this.authService.applyDealerAccessForCurrentUser({
          userId: currentUserId, businessName, contactPhone,
        });

      sendResponse(res, 200, {
        message: wasResubmission
          ? "Dealer access request re-submitted. Await admin approval."
          : "Dealer access request submitted. Await admin approval.",
        data: { user, requiresApproval: true },
      });
    }
  );

  signin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, password, portal } = req.body;
    const result = await this.authService.signin({ email, password, portal });
    const { user } = result;
    const requiresPasswordChange = !!(result as any).requiresPasswordChange;

    if (!requiresPasswordChange) {
      res.cookie("refreshToken", result.refreshToken!, cookieOptions);
      res.cookie("accessToken", result.accessToken!, cookieOptions);
      rotateCsrfToken(res);
    }

    sendResponse(res, 200, {
      data: {
        ...(requiresPasswordChange ? { requiresPasswordChange: true } : {}),
        user: {
          id: user.id,
          accountReference: user.accountReference,
          name: user.name,
          email: user.email,
          phone: user.phone || null,
          role: user.role,
          effectiveRole: user.effectiveRole || user.role,
          avatar: user.avatar,
          isDealer: user.isDealer || false,
          dealerStatus: user.dealerStatus || null,
          dealerBusinessName: user.dealerBusinessName || null,
          dealerContactPhone: user.dealerContactPhone || null,
        },
      },
      message: requiresPasswordChange
        ? "Password change required before accessing your account."
        : "User logged in successfully",
    });

    this.logsService.info("Sign in", { userId: user.id, sessionId: req.session.id });
  });

  signout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const start = Date.now();
    const refreshToken = req?.cookies?.refreshToken;
    let userId = req.user?.id;

    if (!userId && refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, config.auth.refreshTokenSecret) as { id?: string };
        if (typeof decoded.id === "string") userId = decoded.id;
      } catch {
        // Ignore — continue clearing cookies.
      }
    }

    if (refreshToken) {
      const decoded: any = jwt.decode(refreshToken);
      if (decoded && decoded.absExp) {
        const now = Math.floor(Date.now() / 1000);
        const ttl = decoded.absExp - now;
        if (ttl > 0) {
          await tokenUtils.blacklistToken(refreshToken, ttl);
        }
      }
    }

    res.clearCookie("refreshToken", { ...clearCookieOptions });
    res.clearCookie("accessToken", { ...clearCookieOptions });
    rotateCsrfToken(res);

    sendResponse(res, 200, { message: "Logged out successfully" });

    this.logsService.info("Sign out", {
      userId,
      sessionId: req.session.id,
      timePeriod: Date.now() - start,
    });
  });

  /**
   * Forced first-login password change for legacy dealer accounts.
   */
  changePasswordOnFirstLogin = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { email, currentPassword, newPassword } = req.body as {
        email: string;
        currentPassword: string;
        newPassword: string;
      };

      const { user, accessToken, refreshToken } =
        await this.authService.changePasswordOnFirstLogin({ email, currentPassword, newPassword });

      res.cookie("refreshToken", refreshToken, cookieOptions);
      res.cookie("accessToken", accessToken, cookieOptions);
      rotateCsrfToken(res);

      sendResponse(res, 200, {
        message: "Password changed successfully. You are now signed in.",
        data: {
          user: {
            id: user.id,
            accountReference: user.accountReference,
            name: user.name,
            email: user.email,
            phone: user.phone || null,
            role: user.role,
            effectiveRole: user.effectiveRole || user.role,
            avatar: user.avatar || null,
            isDealer: user.isDealer || false,
            dealerStatus: user.dealerStatus || null,
          },
        },
      });

      this.logsService.info("First-login password change", {
        userId: user.id,
        sessionId: req.session.id,
      });
    }
  );

  /**
   * Authenticated self-service password change.
   * Available to ALL roles (USER, DEALER, ADMIN, SUPERADMIN).
   * Requires the current password for re-verification.
   * Issues fresh tokens so the caller's session continues uninterrupted.
   */
  changeOwnPassword = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = req.user?.id;
      if (!userId) throw new AppError(401, "User not authenticated.");

      const { currentPassword, newPassword } = req.body as {
        currentPassword: string;
        newPassword: string;
      };

      const { accessToken, refreshToken } = await this.authService.changeOwnPassword({
        userId,
        currentPassword,
        newPassword,
      });

      // Replace existing cookies with the freshly-issued tokens.
      res.clearCookie("refreshToken", { ...clearCookieOptions });
      res.clearCookie("accessToken", { ...clearCookieOptions });
      res.cookie("refreshToken", refreshToken, cookieOptions);
      res.cookie("accessToken", accessToken, cookieOptions);
      rotateCsrfToken(res);

      sendResponse(res, 200, {
        message: "Password changed successfully. All other sessions have been logged out.",
      });

      this.logsService.info("Self password change", {
        userId,
        sessionId: req.session.id,
      });
    }
  );

  /**
   * SuperAdmin out-of-band emergency reset.
   * Used when a SuperAdmin cannot log in (compromised / forgotten password).
   * Requires the SUPERADMIN_RESET_SECRET env variable.
   */
  resetSuperAdminPassword = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { resetSecret, targetEmail, newPassword } = req.body as {
        resetSecret: string;
        targetEmail: string;
        newPassword: string;
      };

      const result = await this.authService.resetSuperAdminPassword({
        resetSecret,
        targetEmail,
        newPassword,
      });

      sendResponse(res, 200, { message: result.message });

      this.logsService.info("SuperAdmin out-of-band password reset", {
        targetEmail,
        sessionId: req.session?.id,
      });
    }
  );

  requestOwnPasswordResetLink = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = req.user?.id;
      if (!userId) throw new AppError(401, "User not authenticated");

      const response = await this.authService.requestOwnPasswordResetLink(userId);
      sendResponse(res, 200, { message: response.message });

      this.logsService.info("Self password reset link requested", {
        userId,
        sessionId: req.session.id,
      });
    }
  );

  forgotPassword = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { email } = req.body as { email: string };
      const response = await this.authService.forgotPassword(email);
      sendResponse(res, 200, { message: response.message });

      this.logsService.info("Forgot password request", { sessionId: req.session.id });
    }
  );

  resetPassword = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { token, newPassword } = req.body;
      const response = await this.authService.resetPassword(token, newPassword);
      sendResponse(res, 200, { message: response.message });

      this.logsService.info("Password reset via token", {
        userId: req.user?.id,
        sessionId: req.session.id,
      });
    }
  );

  refreshToken = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const start = Date.now();
      const oldRefreshToken = req?.cookies?.refreshToken;

      if (!oldRefreshToken) throw new AppError(401, "Refresh token not found");

      const { newAccessToken, newRefreshToken, user } =
        await this.authService.refreshToken(oldRefreshToken);

      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: config.security.cookieSecure,
        sameSite: config.security.cookieSameSite as "lax" | "strict" | "none",
        path: "/",
      });
      res.clearCookie("accessToken", {
        httpOnly: true,
        secure: config.security.cookieSecure,
        sameSite: config.security.cookieSameSite as "lax" | "strict" | "none",
        path: "/",
      });

      res.cookie("refreshToken", newRefreshToken, cookieOptions);
      res.cookie("accessToken", newAccessToken, cookieOptions);
      rotateCsrfToken(res);

      sendResponse(res, 200, {
        message: "Token refreshed successfully",
        data: { accessToken: newAccessToken, user },
      });

      this.logsService.info("Refresh token", {
        userId: req.user?.id,
        sessionId: req.session.id,
        timePeriod: Date.now() - start,
      });
    }
  );
}
