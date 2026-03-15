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
      res.status(429).json({ success: false, message });
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
  return String(req.ip || req.socket.remoteAddress || "unknown").trim().toLowerCase();
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

export const refreshTokenLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many token refresh attempts. Please log in again.",
  keyGenerator: resolveClientIp,
});

export const graphqlRateLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: "Too many GraphQL requests. Please slow down.",
  keyGenerator: resolveClientIp,
});

export const productsRateLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: "Too many product requests. Please slow down.",
  keyGenerator: resolveClientIp,
});

// ── Change own password (authenticated) ────────────────────────────────────
// Allows up to 5 attempts per 15 minutes per IP+user combination.
// Tighter than login because repeated failures could indicate session hijacking.
export const changePasswordLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many password change attempts. Please try again later.",
  keyGenerator: authRateLimitKey,
});

// ── SuperAdmin emergency reset ──────────────────────────────────────────────
// Extremely tight: 5 attempts per hour per IP.
// Any legitimate use case involves a single deliberate action — there is no
// reason for more than 1-2 requests per session. This prevents brute-forcing
// the SUPERADMIN_RESET_SECRET.
export const superAdminResetLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many SuperAdmin reset attempts. This endpoint is heavily rate-limited.",
  keyGenerator: resolveClientIp,
});
