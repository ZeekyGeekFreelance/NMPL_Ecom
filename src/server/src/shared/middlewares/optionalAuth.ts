import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "@/infra/database/database.config";
import { User } from "../types/userTypes";

const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const accessToken = req.cookies.accessToken;

  if (!accessToken) {
    return next();
  }

  if (!process.env.ACCESS_TOKEN_SECRET) {
    return next();
  }

  try {
    const decoded = jwt.verify(
      accessToken,
      process.env.ACCESS_TOKEN_SECRET
    ) as User;

    const user = await prisma.user.findUnique({
      where: { id: String(decoded.id) },
      select: { id: true, role: true },
    });

    if (user) {
      req.user = user;
    }
  } catch {
    // Optional auth should gracefully continue for guests or invalid tokens.
  }

  next();
};

export default optionalAuth;
