import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "@/infra/database/database.config";
import { User } from "../types/userTypes";
import { config } from "@/config";

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
    const decoded = jwt.verify(
      accessToken,
      config.auth.accessTokenSecret
    ) as User & { tv?: number };

    const user = await prisma.user.findUnique({
      where: { id: String(decoded.id) },
      select: { id: true, role: true, tokenVersion: true },
    });

    if (user) {
      const accessTokenVersion = typeof decoded.tv === "number" ? decoded.tv : 0;
      if (accessTokenVersion !== user.tokenVersion) {
        return next();
      }

      req.user = {
        id: user.id,
        role: user.role,
      };
    }
  } catch {
    // Optional auth should gracefully continue for guests or invalid tokens.
  }

  next();
};

export default optionalAuth;
