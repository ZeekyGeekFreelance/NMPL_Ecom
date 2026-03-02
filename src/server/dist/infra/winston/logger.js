"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const config_1 = require("@/config");
const SENSITIVE_KEY_PATTERN = /(password|token|secret|authorization|cookie|api[-_]?key)/i;
const sanitizeValue = (value) => {
    if (Array.isArray(value)) {
        return value.map((entry) => sanitizeValue(entry));
    }
    if (value && typeof value === "object") {
        const source = value;
        const sanitized = {};
        for (const [key, entry] of Object.entries(source)) {
            sanitized[key] = SENSITIVE_KEY_PATTERN.test(key)
                ? "[REDACTED]"
                : sanitizeValue(entry);
        }
        return sanitized;
    }
    return value;
};
const sanitizeFormat = winston_1.default.format((info) => {
    const sanitized = sanitizeValue(info);
    if (!("traceId" in sanitized)) {
        sanitized.traceId = "system";
    }
    return sanitized;
});
const logger = winston_1.default.createLogger({
    level: config_1.config.isDevelopment ? "debug" : "info",
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), sanitizeFormat(), winston_1.default.format.errors({ stack: !config_1.config.isProduction }), winston_1.default.format.json()),
    transports: [
        new winston_1.default.transports.Console(),
        new winston_1.default.transports.File({
            filename: path_1.default.join(__dirname, "../logs/error.log"),
            level: "error",
        }),
        new winston_1.default.transports.File({
            filename: path_1.default.join(__dirname, "../logs/combined.log"),
        }),
    ],
});
logger.exceptions.handle(new winston_1.default.transports.File({
    filename: path_1.default.join(__dirname, "../logs/exceptions.log"),
}));
exports.default = logger;
