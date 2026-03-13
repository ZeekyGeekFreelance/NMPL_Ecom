import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";

/**
 * Authorizes the request based on the user's effective role already set by
 * the `protect` middleware. Avoids a redundant DB round-trip per request.
 * Falls back to `req.user.role` when `effectiveRole` is not available.
 */
const authorizeRole = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !req.user.id) {
      return next(new AppError(401, "Unauthorized: No user found"));
    }

    // effectiveRole is set by protect / optionalAuth and reflects dealer escalation.
    const roleToCheck = req.user.effectiveRole || req.user.role;

    if (!allowedRoles.includes(roleToCheck)) {
      return next(
        new AppError(403, "You are not authorized to perform this action")
      );
    }

    next();
  };
};

export default authorizeRole;
