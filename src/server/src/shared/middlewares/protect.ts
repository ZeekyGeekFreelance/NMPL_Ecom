import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import AppError from "../errors/AppError";
import prisma from "@/infra/database/database.config";
import { User } from "../types/userTypes";
import { resolveEffectiveRoleFromUser } from "@/shared/utils/userRole";
import { config } from "@/config";
import {
  getProtectUserCache,
  setProtectUserCache,
  type ProtectUserCacheRecord,
} from "@/shared/utils/auth/protectCache";

const protect = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const accessToken = req?.cookies?.accessToken;
    if (!accessToken) {
      return next(new AppError(401, "Unauthorized, please log in"));
    }

    const cachedDecoded = req._decodedAccessToken as
      | (User & { tv?: number })
      | undefined;
    const decoded =
      cachedDecoded ||
      (jwt.verify(accessToken, config.auth.accessTokenSecret) as User & {
        tv?: number;
      });
    req._decodedAccessToken = decoded;

    const userId = String(decoded.id);

    // ── Redis cache lookup ────────────────────────────────────────────────
    // Skips the DB round-trip on the hot path.  The record is invalidated
    // explicitly whenever tokenVersion changes (password reset, dealer status
    // update) and expires automatically after 60 s as a safety backstop.
    let user: ProtectUserCacheRecord | null = await getProtectUserCache(userId);

    if (!user) {
      // Cache miss — query the database and populate the cache.
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          tokenVersion: true,
          dealerProfile: {
            select: {
              status: true,
            },
          },
        },
      });

      if (!dbUser) {
        return next(new AppError(401, "User no longer exists."));
      }

      user = {
        id: dbUser.id,
        role: dbUser.role as string,
        tokenVersion: dbUser.tokenVersion,
        dealerProfile: dbUser.dealerProfile
          ? { status: dbUser.dealerProfile.status as string }
          : null,
      };

      // Fire-and-forget: cache write failure must never block the request.
      await setProtectUserCache(userId, user);
    }

    const accessTokenVersion = typeof decoded.tv === "number" ? decoded.tv : 0;
    if (accessTokenVersion !== user.tokenVersion) {
      return next(new AppError(401, "Your session has expired, please login again."));
    }

    req.user = {
      id: decoded.id,
      role: user.role as any,
      effectiveRole: resolveEffectiveRoleFromUser(user as any),
    };
    next();
  } catch (error) {
    return next(new AppError(401, "Invalid access token, please log in"));
  }
};

export default protect;
