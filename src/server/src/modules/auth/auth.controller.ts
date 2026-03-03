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
        email,
        phone,
        purpose,
        requestDealerAccess,
      });

      sendResponse(res, 200, {
        message: response.message,
        data: {
          resendAvailableInSeconds: response.resendAvailableInSeconds,
        },
      });
    }
  );

  signup = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const start = Date.now();
    const {
      name,
      email,
      phone,
      password,
      emailOtpCode,
      phoneOtpCode,
      requestDealerAccess,
      businessName,
      contactPhone,
    } = req.body;
    const { user, accessToken, refreshToken, requiresApproval } =
      await this.authService.registerUser({
        name,
        email,
        phone,
        password,
        emailOtpCode,
        phoneOtpCode,
        requestDealerAccess,
        businessName,
        contactPhone,
      });

    if (accessToken && refreshToken) {
      res.cookie("refreshToken", refreshToken, cookieOptions);
      res.cookie("accessToken", accessToken, cookieOptions);
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

    const userId = user.id;
    const end = Date.now();
    this.logsService.info("Register", {
      userId,
      sessionId: req.session.id,
      timePeriod: end - start,
    });
  });

  signin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;
    const { user, accessToken, refreshToken } = await this.authService.signin({
      email,
      password,
    });

    res.cookie("refreshToken", refreshToken, cookieOptions);
    res.cookie("accessToken", accessToken, cookieOptions);

    const userId = user.id;

    sendResponse(res, 200, {
      data: {
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
      message: "User logged in successfully",
    });

    const start = Date.now();
    const end = Date.now();

    this.logsService.info("Sign in", {
      userId,
      sessionId: req.session.id,
      timePeriod: end - start,
    });
  });

  signout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const start = Date.now();
    const refreshToken = req?.cookies?.refreshToken;
    let userId = req.user?.id;

    if (!userId && refreshToken) {
      try {
        const decoded = jwt.verify(
          refreshToken,
          config.auth.refreshTokenSecret
        ) as { id?: string };
        if (typeof decoded.id === "string") {
          userId = decoded.id;
        }
      } catch {
        // Ignore invalid refresh token and continue clearing cookies.
      }
    }

    // Preserve cart on sign-out for all external accounts (customer + dealer)
    // to ensure parity and continuity across sessions.

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

    res.clearCookie("refreshToken", {
      ...clearCookieOptions,
    });

    res.clearCookie("accessToken", {
      ...clearCookieOptions,
    });

    sendResponse(res, 200, { message: "Logged out successfully" });
    const end = Date.now();

    this.logsService.info("Sign out", {
      userId,
      sessionId: req.session.id,
      timePeriod: end - start,
    });
  });

  requestOwnPasswordResetLink = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, "User not authenticated");
      }

      const response = await this.authService.requestOwnPasswordResetLink(userId);

      sendResponse(res, 200, { message: response.message });

      this.logsService.info("Self Password Reset Link Requested", {
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

      this.logsService.info("Forgot Password Link Requested", {
        sessionId: req.session.id,
      });
    }
  );

  resetPassword = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { token, newPassword } = req.body;
      const response = await this.authService.resetPassword(token, newPassword);
      const userId = req.user?.id;

      sendResponse(res, 200, { message: response.message });
      const start = Date.now();
      const end = Date.now();

      this.logsService.info("Reset Password", {
        userId,
        sessionId: req.session.id,
        timePeriod: end - start,
      });
    }
  );

  refreshToken = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const start = Date.now();
      const oldRefreshToken = req?.cookies?.refreshToken;

      if (!oldRefreshToken) {
        throw new AppError(401, "Refresh token not found");
      }

      const { newAccessToken, newRefreshToken, user } =
        await this.authService.refreshToken(oldRefreshToken);

      res.cookie("refreshToken", newRefreshToken, cookieOptions);
      res.cookie("accessToken", newAccessToken, cookieOptions);

      sendResponse(res, 200, {
        message: "Token refreshed successfully",
        data: { accessToken: newAccessToken, user },
      });
      const end = Date.now();

      this.logsService.info("Refresh Token", {
        userId: req.user?.id,
        sessionId: req.session.id,
        timePeriod: end - start,
      });
    }
  );
}
