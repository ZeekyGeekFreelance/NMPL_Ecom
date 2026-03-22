import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";
import { config } from "@/config";

const SESSION_COOKIE_NAME = "sessionId";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

const sessionCookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: config.security.cookieSameSite as "lax" | "strict" | "none",
  path: "/",
  signed: true,
  maxAge: SESSION_MAX_AGE_MS,
  ...(config.security.cookieDomain
    ? { domain: config.security.cookieDomain }
    : {}),
} as const;

const getSignedSessionId = (req: Request): string | null => {
  const cookie = req.signedCookies?.[SESSION_COOKIE_NAME];
  return typeof cookie === "string" && cookie.trim().length > 0
    ? cookie.trim()
    : null;
};

export const attachRequestSession = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const existingSessionId = getSignedSessionId(req);
  const sessionId = existingSessionId || randomUUID();

  if (!existingSessionId) {
    res.cookie(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions);
  }

  req.session = { id: sessionId };
  next();
};

export default attachRequestSession;
