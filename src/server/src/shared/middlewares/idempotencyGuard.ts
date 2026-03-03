import { NextFunction, Request, Response } from "express";
import { createHash, randomUUID } from "crypto";
import redis from "@/infra/cache/redis";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const IDEMPOTENCY_TTL_SECONDS = 120;
const IDEMPOTENCY_EXCLUDED_PATHS = [
  "/auth/refresh-token",
  "/analytics/interactions",
];

const isMutationRequest = (method: string) =>
  MUTATION_METHODS.has(method.toUpperCase());

const normalizePath = (path: string) => {
  const [cleanPath] = path.split("?");
  return cleanPath || "/";
};

const sanitizeRequestBody = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const SENSITIVE_KEYS = [
    "password",
    "token",
    "secret",
    "authorization",
    "accessToken",
    "refreshToken",
  ];

  const visited = new WeakSet<object>();
  const scrub = (value: unknown, depth: number): unknown => {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value !== "object") {
      return value;
    }

    if (depth > 3) {
      return "[TRUNCATED]";
    }

    if (visited.has(value as object)) {
      return "[CIRCULAR]";
    }
    visited.add(value as object);

    if (Array.isArray(value)) {
      return value.slice(0, 20).map((entry) => scrub(entry, depth + 1));
    }

    const result: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>)
      .slice(0, 40)
      .forEach(([key, nested]) => {
        const isSensitive = SENSITIVE_KEYS.some((token) =>
          key.toLowerCase().includes(token.toLowerCase())
        );
        result[key] = isSensitive ? "[REDACTED]" : scrub(nested, depth + 1);
      });
    return result;
  };

  return scrub(payload, 0);
};

const buildFallbackKey = (req: Request) => {
  const actorId = req.user?.id || req.session?.id || "anonymous";
  const normalizedPath = normalizePath(req.originalUrl || req.url || "");
  const payload = JSON.stringify(sanitizeRequestBody(req.body) || {});
  const payloadDigest = createHash("sha256").update(payload).digest("hex");

  return createHash("sha256")
    .update(`${actorId}|${req.method.toUpperCase()}|${normalizedPath}|${payloadDigest}`)
    .digest("hex");
};

const shouldBypassIdempotency = (normalizedPath: string) =>
  IDEMPOTENCY_EXCLUDED_PATHS.some((path) => normalizedPath.startsWith(path));

const parseHeaderValue = (value: string | string[] | undefined) => {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return String(value[0] || "").trim();
  }

  return "";
};

export const idempotencyGuard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!isMutationRequest(req.method)) {
    next();
    return;
  }

  const normalizedPath = normalizePath(req.path || req.originalUrl || req.url || "");
  if (shouldBypassIdempotency(normalizedPath)) {
    next();
    return;
  }

  const incomingKey = parseHeaderValue(req.headers["x-idempotency-key"]);
  const idempotencyKey = incomingKey || buildFallbackKey(req) || randomUUID();
  const redisKey = `idempotency:${idempotencyKey}`;

  try {
    const stored = await redis.set(
      redisKey,
      JSON.stringify({
        method: req.method.toUpperCase(),
        path: normalizedPath,
        traceId: req.traceId || null,
        createdAt: new Date().toISOString(),
      }),
      "EX",
      IDEMPOTENCY_TTL_SECONDS,
      "NX"
    );

    if (stored !== "OK") {
      res.status(409).json({
        success: false,
        message:
          "Duplicate mutation blocked by idempotency guard. Please refresh before retrying.",
      });
      return;
    }

    res.setHeader("x-idempotency-key", idempotencyKey);

    res.on("finish", async () => {
      if (res.statusCode >= 400) {
        try {
          await redis.del(redisKey);
        } catch {
          // Best effort cleanup only.
        }
      }
    });

    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      success: false,
      message: `Failed to apply idempotency guard: ${message}`,
    });
  }
};

export default idempotencyGuard;

