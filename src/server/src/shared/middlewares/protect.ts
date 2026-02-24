import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import AppError from "../errors/AppError";
import prisma from "@/infra/database/database.config";
import { User } from "../types/userTypes";

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

    if (!process.env.ACCESS_TOKEN_SECRET) {
      return next(new AppError(500, "Authentication secret is not configured"));
    }

    const decoded = jwt.verify(
      accessToken,
      process.env.ACCESS_TOKEN_SECRET!
    ) as User;

    const user = await prisma.user.findUnique({
      where: { id: String(decoded.id) },
      select: { id: true, role: true },
    });

    if (!user) {
      return next(new AppError(401, "User no longer exists."));
    }

    req.user = { id: decoded.id, role: user.role };
    next();
  } catch (error) {
    return next(new AppError(401, "Invalid access token, please log in"));
  }
};

export default protect;
