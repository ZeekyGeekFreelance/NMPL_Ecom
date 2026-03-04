import { Request, Response, NextFunction } from "express";
import AppError from "./AppError";
import logger from "@/infra/winston/logger";
import { makeLogsService } from "@/modules/logs/logs.factory";
import { config } from "@/config";
import multer from "multer";

interface CustomError extends Error {
  name: string;
  code?: number | string;
  errors?: Record<string, { message: string }>;
  path?: string;
  value?: unknown;
  details?: { message: string }[];
  stack?: string;
}

const logsService = makeLogsService();

type ErrorHandler = (err: CustomError) => AppError;

const errorHandlers: Record<string | number, ErrorHandler> = {
  ValidationError: (err) =>
    new AppError(
      400,
      Object.values(err.errors || {})
        .map((val) => val.message)
        .join(", ")
    ),
  11000: () => new AppError(400, "Duplicate field value entered"),
  CastError: (err) => new AppError(400, `Invalid ${err.path}: ${err.value}`),
  TokenExpiredError: () =>
    new AppError(401, "Your session has expired, please login again."),
  Joi: (err) =>
    new AppError(
      400,
      (err.details || []).map((detail) => detail.message).join(", ")
    ),
  PrismaClientKnownRequestError: (err) => {
    switch (err.code) {
      case "P2002":
        return new AppError(400, "Duplicate field value entered");
      case "P2025":
        return new AppError(404, "Record not found");
      default:
        return new AppError(400, `Prisma error: ${err.message}`);
    }
  },
  PrismaClientValidationError: () =>
    new AppError(400, "Invalid input. Please check your request data."),
  PrismaClientInitializationError: () =>
    new AppError(500, "Database initialization error. Please try again later."),
  PrismaClientRustPanicError: () =>
    new AppError(
      500,
      "Unexpected internal server error. Please try again later."
    ),
};

const globalError = async (
  err: CustomError | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  // Handle Multer file upload errors before general processing.
  if (err instanceof multer.MulterError) {
    const multerMessages: Record<string, string> = {
      LIMIT_FILE_SIZE: "File too large. Maximum allowed size is 10 MB.",
      LIMIT_FILE_COUNT: "Too many files. Maximum 5 files allowed per upload.",
      LIMIT_UNEXPECTED_FILE: "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.",
      LIMIT_FIELD_VALUE: "Field value too large.",
    };
    const message = multerMessages[err.code] || `Upload error: ${err.message}`;
    res.status(400).json({ status: "fail", message, traceId: req.traceId || "unknown" });
    return;
  }

  let error: AppError =
    err instanceof AppError ? err : new AppError(500, err.message);

  const isDev = config.isDevelopment;
  const isProd = config.isProduction;
  const traceId = req.traceId || "unknown";

  const handler =
    errorHandlers[err.name] ||
    errorHandlers[err.constructor.name] ||
    ("code" in err ? errorHandlers[err.code || 500] : undefined);

  if (typeof handler === "function") {
    error = handler(err as CustomError);
  }

  if (isDev) {
    console.error("Error Name:", err.name);
    console.error("Stack Trace:", err.stack?.split("\n").slice(0, 5).join("\n"));

    logger.error({
      message: error.message,
      statusCode: error.statusCode,
      method: req.method,
      path: req.originalUrl,
      traceId,
      stack: error.stack,
      ...(error.details && { details: error.details }),
    });
  }

  if (isProd && error.isOperational) {
    logger.error(
      `[${req.method}] ${req.originalUrl} - ${error.statusCode} - ${error.message} - traceId=${traceId}`
    );
  }

  const start = Date.now();
  try {
    await logsService.error(`Error: ${error.message}`, {
      statusCode: error.statusCode,
      stack: isDev ? err.stack : undefined,
      method: req.method,
      url: req.originalUrl,
      traceId,
      userId: (req as { user?: { id?: string } }).user?.id || null,
      timePeriod: Date.now() - start,
    });
  } catch (loggingError) {
    const logErrorMessage =
      loggingError instanceof Error ? loggingError.message : String(loggingError);
    logger.error(`[globalError] Failed to persist error log: ${logErrorMessage}`);
  }

  res.status(error.statusCode || 500).json({
    status:
      error.statusCode >= 400 && error.statusCode < 500 ? "fail" : "error",
    traceId,
    message: error.message,
    ...(error.details && { errors: error.details }),
    ...(isDev && {
      stack: error.stack,
      error,
    }),
  });
};

export default globalError;
