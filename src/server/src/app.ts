import express from "express";
import "./infra/cloudinary/config";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import hpp from "hpp";
import morgan from "morgan";
import logger from "./infra/winston/logger";
import compression from "compression";
import passport from "passport";
import session from "express-session";
import { RedisStore } from "connect-redis";
import redisClient from "./infra/cache/redis";
import configurePassport from "./infra/passport/passport";
import { cookieParserOptions } from "./shared/constants";
import globalError from "./shared/errors/globalError";
import { logRequest } from "./shared/middlewares/logRequest";
import { normalizeTextPayload } from "./shared/middlewares/normalizeTextPayload";
import { configureRoutes } from "./routes";
import { configureGraphQL } from "./graphql";
import webhookRoutes from "./modules/webhook/webhook.routes";
import healthRoutes from "./routes/health.routes";
import { Server as HTTPServer } from "http";
import { setupSwagger } from "./docs/swagger";
import { config, isAllowedOrigin } from "@/config";
import { bootState } from "@/bootstrap/state";
import { randomUUID } from "crypto";
import { createRequestMetricsMiddleware } from "@/shared/observability/requestMetrics";

const parseCspDirectives = (value: string): Record<string, string[]> => {
  const directives = value
    .split(";")
    .map((directive) => directive.trim())
    .filter(Boolean);

  if (directives.length === 0) {
    throw new Error("[app] CSP_DIRECTIVES is empty or invalid");
  }

  const parsed: Record<string, string[]> = {};
  for (const directive of directives) {
    const [name, ...items] = directive.split(" ").map((token) => token.trim());
    if (!name) {
      throw new Error(`[app] Invalid CSP directive segment: ${directive}`);
    }
    parsed[name] = items.length > 0 ? items : ["'none'"];
  }

  return parsed;
};

export const createApp = async () => {
  const app = express();

  // ── HTTP server created immediately so it can be returned and listened on
  // BEFORE the database connection is established.  The readiness gate below
  // ensures API routes return 503 until the DB + Redis are fully connected.
  const httpServer = new HTTPServer(app);

  setupSwagger(app);
  app.disable("x-powered-by");
  app.set("trust proxy", config.server.trustProxy ? 1 : 0);

  // ── Trace-ID injection ───────────────────────────────────────────────────
  app.use((req, res, next) => {
    const incomingTraceId = String(req.headers["x-trace-id"] || "").trim();
    const traceId = incomingTraceId || randomUUID();
    req.traceId = traceId;
    res.setHeader("x-trace-id", traceId);
    next();
  });
  app.use(createRequestMetricsMiddleware());

  // ── Health / liveness endpoints ──────────────────────────────────────────
  // Registered FIRST — before session, passport, CORS, and the readiness gate —
  // so Docker healthchecks and the frontend useBackendReady poll always get a
  // response, even during the DB connection phase (bootState.serverReady=false).
  app.use("/", healthRoutes);

  // ── Webhook routes (raw body required for Stripe signature verification) ─
  app.use(
    "/api/v1/webhook",
    bodyParser.raw({ type: "application/json", limit: config.server.bodyJsonLimit }),
    webhookRoutes
  );

  app.use(express.json({ limit: config.server.bodyJsonLimit }));
  app.use(
    bodyParser.urlencoded({
      extended: true,
      limit: config.server.bodyUrlEncodedLimit,
      parameterLimit: 500,
    })
  );
  app.use(normalizeTextPayload);
  app.use(cookieParser(config.security.cookieSecret, cookieParserOptions));

  const sessionConfig: session.SessionOptions = {
    secret: config.security.sessionSecret,
    resave: false,
    saveUninitialized: false,
    proxy: config.server.trustProxy,
    name: "sessionId",
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: config.security.cookieSameSite,
      domain: config.security.cookieDomain,
      maxAge: 1000 * 60 * 60 * 24 * 7,
      path: "/",
    },
  };

  if (config.redis.enabled) {
    // RedisStore is created here; the underlying ioredis client connects
    // asynchronously in the bootstrap.  connect-redis gracefully queues
    // session ops until the client is ready, so this is safe to create now.
    sessionConfig.store = new RedisStore({ client: redisClient as any });
  } else if (config.isDevelopment) {
    console.warn(
      "[session] Redis is disabled in development. Using in-memory session store."
    );
  }

  const sessionMiddleware = session(sessionConfig);

  const isPublicCatalog = (req: express.Request) =>
    req.method === "POST" &&
    req.path === "/api/v1/graphql" &&
    req.headers["x-public-catalog"] === "1";

  // Skip session + passport for public catalog — saves Redis round-trip per request.
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (isPublicCatalog(req)) { next(); return; }
    sessionMiddleware(req, res, next);
  });

  app.use(passport.initialize());
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (isPublicCatalog(req)) { next(); return; }
    passport.session()(req, res, next);
  });
  configurePassport();

  app.use((req, res, next) => {
    if (req.headers["access-control-request-private-network"] === "true") {
      res.setHeader("Access-Control-Allow-Private-Network", "true");
    }
    next();
  });

  app.use(
    cors({
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`Origin not allowed by CORS: ${origin}`));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "x-confirmation-handled",
        "x-idempotency-key",
        "Apollo-Require-Preflight",
        "x-public-catalog",
        "x-csrf-token",
      ],
      exposedHeaders: ["x-csrf-token"],
    })
  );

  if (config.isProduction && config.security.helmetEnabled) {
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: parseCspDirectives(config.security.csp),
        },
      })
    );
    app.use(helmet.frameguard({ action: "deny" }));
    app.use(
      helmet.hsts({
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      })
    );
    app.use(helmet.referrerPolicy({ policy: "no-referrer" }));
    app.use(helmet.permittedCrossDomainPolicies());
    app.use((_req, res, next) => {
      res.setHeader("X-Frame-Options", "DENY");
      next();
    });
  }

  app.use(
    hpp({
      whitelist: ["sort", "filter", "fields", "page", "limit"],
    })
  );

  app.use(
    morgan("combined", {
      stream: {
        write: (message) => logger.info(message.trim()),
      },
    })
  );
  app.use(compression());

  // ── Readiness gate ───────────────────────────────────────────────────────
  // Block all /api and /graphql traffic with 503 until the full boot sequence
  // (DB connect + Redis connect) has completed and bootState.serverReady=true.
  // /health, /ready, and /live bypass this gate so Docker probes always work.
  // The frontend RetryLink transparently retries 503s with exponential backoff.
  app.use(["/api", "/api/v1/graphql"], (req, res, next) => {
    if (!bootState.serverReady) {
      res.status(503).json({
        status: "error",
        message: "Server is starting up. Please retry in a moment.",
        retryAfterSeconds: 5,
      });
      return;
    }
    next();
  });

  app.use("/api", configureRoutes());
  await configureGraphQL(app);

  app.use(logRequest);
  app.use(globalError);

  // NOTE: bootState.serverReady is intentionally NOT set here.
  // It is set in server.ts bootstrap() AFTER connectDB() and connectRedis()
  // both resolve successfully, so the readiness gate above only opens once
  // the full data layer is ready.

  return { app, httpServer };
};
