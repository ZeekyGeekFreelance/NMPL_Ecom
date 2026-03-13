import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "@/infra/database/database.config";
import { User } from "../types/userTypes";
import { config } from "@/config";
import { resolveEffectiveRoleFromUser } from "@/shared/utils/userRole";

const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const accessToken = req.cookies.accessToken;

  if (!accessToken) {
    return next();
  }

  try {
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

    if (user) {
      const accessTokenVersion = typeof decoded.tv === "number" ? decoded.tv : 0;
      if (accessTokenVersion !== user.tokenVersion) {
        return next();
      }

      req.user = {
        id: user.id,
        role: user.role,
        effectiveRole: resolveEffectiveRoleFromUser(user),
      };
    }
  } catch {
    // Optional auth should gracefully continue for guests or invalid tokens.
  }

  next();
};

export default optionalAuth;
