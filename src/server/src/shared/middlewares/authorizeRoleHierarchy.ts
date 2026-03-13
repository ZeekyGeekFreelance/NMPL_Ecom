import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";
import prisma from "@/infra/database/database.config";
import { getProtectUserCache } from "@/shared/utils/auth/protectCache";

const getRoleHierarchy = (role: string): number => {
  const hierarchy: { [key: string]: number } = {
    USER: 1,
    DEALER: 1,
    ADMIN: 2,
    SUPERADMIN: 3,
  };
  return hierarchy[String(role || "").toUpperCase()] || 0;
};

const authorizeRoleHierarchy = (minRequiredRole: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.id) {
        return next(new AppError(401, "Unauthorized: No user found"));
      }

      const userRole = req.user.effectiveRole || req.user.role;
      const targetUserId = req.params.id;

      if (!targetUserId) {
        return next(new AppError(400, "Target user ID is required"));
      }

      if (req.user.id === targetUserId) {
        return next(
          new AppError(
            403,
            "Cannot modify your own account from this interface"
          )
        );
      }

      // Check if user has minimum required role
      if (getRoleHierarchy(userRole) < getRoleHierarchy(minRequiredRole)) {
        return next(
          new AppError(403, "You are not authorized to perform this action")
        );
      }

      // #11: Resolve the target user's role from the protect cache before falling back to a
      // DB query. The cache is warm for any recently active user and has a 60-second TTL,
      // so the vast majority of admin-on-user operations never touch the DB here.
      let targetUserRole: string;
      const cachedTarget = await getProtectUserCache(targetUserId);
      if (cachedTarget) {
        targetUserRole = cachedTarget.role;
      } else {
        const targetUser = await prisma.user.findUnique({
          where: { id: targetUserId },
          select: { role: true },
        });
        if (!targetUser) {
          return next(new AppError(404, "Target user not found"));
        }
        targetUserRole = targetUser.role;
      }

      const actorHierarchy = getRoleHierarchy(userRole);
      const targetHierarchy = getRoleHierarchy(targetUserRole);

      // SuperAdmin can manage other SuperAdmins (except self), and the
      // service layer enforces last-superadmin protections for delete/demote.
      if (
        userRole !== "SUPERADMIN" &&
        targetHierarchy >= actorHierarchy
      ) {
        return next(
          new AppError(
            403,
            "Cannot modify users with equal or higher privileges"
          )
        );
      }

      next();
    } catch (error) {
      return next(new AppError(500, "Internal server error"));
    }
  };
};

export default authorizeRoleHierarchy;
