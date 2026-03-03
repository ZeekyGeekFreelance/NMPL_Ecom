import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import AppError from "../errors/AppError";
import prisma from "@/infra/database/database.config";
import { User } from "../types/userTypes";
import { resolveEffectiveRoleFromUser } from "@/shared/utils/userRole";
import { config } from "@/config";

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

    const user = await prisma.user.findUnique({
      where: { id: String(decoded.id) },
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

    if (!user) {
      return next(new AppError(401, "User no longer exists."));
    }

    const accessTokenVersion = typeof decoded.tv === "number" ? decoded.tv : 0;
    if (accessTokenVersion !== user.tokenVersion) {
      return next(new AppError(401, "Your session has expired, please login again."));
    }

    req.user = {
      id: decoded.id,
      role: user.role,
      effectiveRole: resolveEffectiveRoleFromUser(user),
    };
    next();
  } catch (error) {
    return next(new AppError(401, "Invalid access token, please log in"));
  }
};

export default protect;
