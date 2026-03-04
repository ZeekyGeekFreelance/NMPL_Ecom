import { NextFunction, Request, Response } from "express";
import prisma from "@/infra/database/database.config";
import { makeLogsService } from "@/modules/logs/logs.factory";

const logsService = makeLogsService();
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ACTION_SEGMENTS = new Set([
  "status",
  "bulk",
  "slug",
  "default",
  "item",
  "value",
  "assign-category",
  "assign-product",
  "merge",
  "quotation",
  "level",
  "download",
  "me",
]);

type MutationContext = {
  entity: string;
  entityId: string | null;
  previousState: unknown;
  pathSegments: string[];
};

const isMutationRequest = (method: string) =>
  MUTATION_METHODS.has(method.toUpperCase());

const normalizePath = (path: string) => {
  const [cleanPath] = path.split("?");
  return cleanPath || "/";
};

const redactPayload = (payload: unknown) => {
  const SENSITIVE_KEYS = [
    "password",
    "token",
    "secret",
    "authorization",
    "accessToken",
    "refreshToken",
  ];
  const visited = new WeakSet<object>();

  const sanitize = (value: unknown, depth: number): unknown => {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value !== "object") {
      if (typeof value === "string" && value.length > 500) {
        return `${value.slice(0, 500)}...`;
      }
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
      return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
    }

    const result: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>)
      .slice(0, 40)
      .forEach(([key, nested]) => {
        const sensitive = SENSITIVE_KEYS.some((token) =>
          key.toLowerCase().includes(token)
        );
        result[key] = sensitive ? "[REDACTED]" : sanitize(nested, depth + 1);
      });

    return result;
  };

  return sanitize(payload, 0);
};

const isLikelyEntityId = (segment: string) => {
  if (!segment) {
    return false;
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const numericPattern = /^\d+$/;

  return uuidPattern.test(segment) || numericPattern.test(segment);
};

const extractEntityContext = (req: Request): MutationContext => {
  const normalizedPath = normalizePath(req.path || req.originalUrl || req.url || "");
  const pathSegments = normalizedPath.split("/").filter(Boolean);
  const entity = pathSegments[0] || "unknown";

  let entityId: string | null = null;

  for (let index = 1; index < pathSegments.length; index += 1) {
    const segment = pathSegments[index];
    if (ACTION_SEGMENTS.has(segment)) {
      continue;
    }
    if (isLikelyEntityId(segment)) {
      entityId = segment;
      break;
    }
  }

  if (!entityId && entity === "sections" && pathSegments[1]) {
    entityId = pathSegments[1];
  }

  if (!entityId && entity === "transactions" && pathSegments[2]) {
    entityId = pathSegments[2];
  }

  if (!entityId && entity === "users" && pathSegments[1] === "dealers" && pathSegments[2]) {
    entityId = pathSegments[2];
  }

  return {
    entity,
    entityId,
    previousState: null,
    pathSegments,
  };
};

const fetchPreviousState = async (
  entity: string,
  entityId: string | null,
  pathSegments: string[]
) => {
  if (!entityId) {
    return null;
  }

  try {
    switch (entity) {
      case "users":
        return prisma.user.findUnique({
          where: { id: entityId },
          include: { dealerProfile: true },
        });
      case "products":
        return prisma.product.findUnique({
          where: { id: entityId },
          include: {
            category: true,
            variants: {
              include: { attributes: true },
            },
          },
        });
      case "variants":
        return prisma.productVariant.findUnique({
          where: { id: entityId },
          include: { attributes: true },
        });
      case "categories":
        return prisma.category.findUnique({ where: { id: entityId } });
      case "attributes":
        if (pathSegments[1] === "value") {
          return prisma.attributeValue.findUnique({ where: { id: entityId } });
        }
        return prisma.attribute.findUnique({ where: { id: entityId } });
      case "sections":
        return prisma.section.findFirst({
          where: { type: entityId as any },
        });
      case "transactions":
        return prisma.transaction.findUnique({
          where: { id: entityId },
          include: {
            order: true,
          },
        });
      case "orders":
        return prisma.order.findUnique({
          where: { id: entityId },
          include: {
            orderItems: true,
            transaction: true,
            payment: true,
            shipment: true,
            quotationLogs: true,
          },
        });
      case "addresses":
        return prisma.address.findUnique({ where: { id: entityId } });
      case "payments":
        return prisma.payment.findUnique({ where: { id: entityId } });
      case "shipment":
        return prisma.shipment.findUnique({ where: { id: entityId } });
      case "logs":
        return prisma.log.findUnique({ where: { id: entityId } });
      case "cart":
        if (pathSegments[1] === "item") {
          return prisma.cartItem.findUnique({ where: { id: entityId } });
        }
        return prisma.cart.findUnique({ where: { id: entityId } });
      case "chat":
        return prisma.chat.findUnique({ where: { id: entityId } });
      default:
        return null;
    }
  } catch {
    return null;
  }
};

const parseIdempotencyKey = (req: Request) => {
  const headerValue = req.headers["x-idempotency-key"];
  if (typeof headerValue === "string") {
    return headerValue.trim() || null;
  }
  if (Array.isArray(headerValue)) {
    return String(headerValue[0] || "").trim() || null;
  }
  return null;
};

export const mutationAuditLogger = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!isMutationRequest(req.method)) {
    next();
    return;
  }

  const startedAt = Date.now();
  const occurredAt = new Date().toISOString();
  const context = extractEntityContext(req);

  // Fetch previous state best-effort — never block the request on a failure.
  try {
    context.previousState = await fetchPreviousState(
      context.entity,
      context.entityId,
      context.pathSegments
    );
  } catch {
    context.previousState = null;
  }

  res.on("finish", () => {
    const payload = {
      actorId: req.user?.id || null,
      sessionId: req.session?.id || null,
      method: req.method.toUpperCase(),
      path: normalizePath(req.originalUrl || req.url || ""),
      entity: context.entity,
      entityId: context.entityId,
      statusCode: res.statusCode,
      occurredAt,
      durationMs: Date.now() - startedAt,
      traceId: req.traceId || null,
      idempotencyKey: parseIdempotencyKey(req),
      requestBody: redactPayload(req.body),
      previousState: redactPayload(context.previousState),
    };

    if (res.statusCode < 400) {
      void logsService.info("Mutation audit trail", payload);
      return;
    }

    void logsService.warn("Mutation audit trail (failed)", payload);
  });

  next();
};

export default mutationAuditLogger;
