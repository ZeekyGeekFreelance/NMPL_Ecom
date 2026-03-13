import rateLimit from "express-rate-limit";
import { Request } from "express";
import { config } from "@/config";

if (config.isProduction && !config.rateLimit.enabled) {
  throw new Error(
    "[rate-limit] Production boot blocked: RATE_LIMIT_ENABLED must be true."
  );
}

const createLimiter = ({
  windowMs,
  max,
  message,
  keyGenerator,
  skipSuccessfulRequests = false,
}: {
  windowMs: number;
  max: number;
  message: string;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
}) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    skipSuccessfulRequests,
    skip: () => !config.rateLimit.enabled,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        message,
      });
    },
  });

const resolveClientIp = (req: Request): string => {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim().toLowerCase();
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return String(forwardedFor[0]).trim().toLowerCase();
  }

  return String(req.ip || req.socket.remoteAddress || "unknown")
    .trim()
    .toLowerCase();
};

const authRateLimitKey = (req: Request): string => {
  const ip = resolveClientIp(req);
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";

  return email ? `${ip}:${email}` : ip;
};

export const authRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimit.loginMax,
  message: "Too many login attempts. Please try again later.",
  keyGenerator: authRateLimitKey,
  skipSuccessfulRequests: true,
});

export const otpRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimit.otpMax,
  message: "Too many OTP attempts. Please try again later.",
});

export const passwordResetLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: config.rateLimit.otpMax,
  message: "Too many password reset attempts. Please try again later.",
});

export const registrationLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: config.rateLimit.otpMax,
  message: "Too many registration attempts. Please try again later.",
});

export const orderRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimit.orderMax,
  message: "Too many order placement attempts. Please try again later.",
});

// Dedicated limiter for the token-refresh endpoint.
// Prevents refresh-token flooding / DoS without blocking normal SPA usage
// (a well-behaved client refreshes at most once per access-token lifetime).
export const refreshTokenLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30, // generous for multi-tab usage, tight enough to block floods
  message: "Too many token refresh attempts. Please log in again.",
  keyGenerator: resolveClientIp,
});
