import rateLimit from "express-rate-limit";

/**
 * Rate limiter for authentication endpoints (brute force protection)
 * Maximum 5 login attempts per 15 minutes per IP
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: "Too many authentication attempts. Please try again later.",
  standardHeaders: false, // Don't return RateLimit-* headers
  skip: (req) => {
    // Skip rate limiting in development
    return process.env.NODE_ENV !== "production";
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many authentication attempts. Please try again in 15 minutes.",
    });
  },
});

/**
 * Rate limiter for password reset endpoints
 * Maximum 3 attempts per hour per IP
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: "Too many password reset attempts. Please try again later.",
  standardHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV !== "production";
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many password reset attempts. Please try again in 1 hour.",
    });
  },
});

/**
 * Rate limiter for registration endpoints
 * Maximum 10 registrations per hour per IP
 */
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 attempts per hour
  message: "Too many registration attempts. Please try again later.",
  standardHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV !== "production";
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many registration attempts. Please try again in 1 hour.",
    });
  },
});
