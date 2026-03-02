import rateLimit from "express-rate-limit";
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
}: {
  windowMs: number;
  max: number;
  message: string;
}) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => !config.rateLimit.enabled,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        message,
      });
    },
  });

export const authRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimit.loginMax,
  message: "Too many login attempts. Please try again later.",
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
