"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderRateLimiter = exports.registrationLimiter = exports.passwordResetLimiter = exports.otpRateLimiter = exports.authRateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const config_1 = require("@/config");
if (config_1.config.isProduction && !config_1.config.rateLimit.enabled) {
    throw new Error("[rate-limit] Production boot blocked: RATE_LIMIT_ENABLED must be true.");
}
const createLimiter = ({ windowMs, max, message, }) => (0, express_rate_limit_1.default)({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => !config_1.config.rateLimit.enabled,
    handler: (_req, res) => {
        res.status(429).json({
            success: false,
            message,
        });
    },
});
exports.authRateLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: config_1.config.rateLimit.loginMax,
    message: "Too many login attempts. Please try again later.",
});
exports.otpRateLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: config_1.config.rateLimit.otpMax,
    message: "Too many OTP attempts. Please try again later.",
});
exports.passwordResetLimiter = createLimiter({
    windowMs: 60 * 60 * 1000,
    max: config_1.config.rateLimit.otpMax,
    message: "Too many password reset attempts. Please try again later.",
});
exports.registrationLimiter = createLimiter({
    windowMs: 60 * 60 * 1000,
    max: config_1.config.rateLimit.otpMax,
    message: "Too many registration attempts. Please try again later.",
});
exports.orderRateLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: config_1.config.rateLimit.orderMax,
    message: "Too many order placement attempts. Please try again later.",
});
