import winston from "winston";
import path from "path";
import { config } from "@/config";

const SENSITIVE_KEY_PATTERN = /(password|token|secret|authorization|cookie|api[-_]?key)/i;

const sanitizeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry));
  }

  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(source)) {
      sanitized[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? "[REDACTED]"
        : sanitizeValue(entry);
    }
    return sanitized;
  }

  return value;
};

const sanitizeFormat = winston.format((info) => {
  const sanitized = sanitizeValue(info) as Record<string, unknown>;
  if (!("traceId" in sanitized)) {
    sanitized.traceId = "system";
  }
  return sanitized as winston.Logform.TransformableInfo;
});

const logger = winston.createLogger({
  level: config.isDevelopment ? "debug" : "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    sanitizeFormat(),
    winston.format.errors({ stack: !config.isProduction }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: path.join(__dirname, "../logs/error.log"),
      level: "error",
    }),
    new winston.transports.File({
      filename: path.join(__dirname, "../logs/combined.log"),
    }),
  ],
});

logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(__dirname, "../logs/exceptions.log"),
  })
);

export default logger;
