import express from "express";
import "./infra/cloudinary/config";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import ExpressMongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import morgan from "morgan";
import logger from "./infra/winston/logger";
import compression from "compression";
import passport from "passport";
import session from "express-session";
import { RedisStore } from "connect-redis";
import redisClient, { connectRedis } from "./infra/cache/redis";
import configurePassport from "./infra/passport/passport";
import { cookieParserOptions } from "./shared/constants";
import globalError from "./shared/errors/globalError";
import { logRequest } from "./shared/middlewares/logRequest";
import { configureRoutes } from "./routes";
import { configureGraphQL } from "./graphql";
import webhookRoutes from "./modules/webhook/webhook.routes";
import healthRoutes from "./routes/health.routes";
import { Server as HTTPServer } from "http";
import { SocketManager } from "@/infra/socket/socket";
import { connectDB } from "./infra/database/database.config";
import { setupSwagger } from "./docs/swagger";
import { startQuotationExpiryWorker } from "./modules/transaction/quotationExpiry.worker";
import { config, isAllowedOrigin } from "@/config";
import { randomUUID } from "crypto";

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

  await connectDB();
  if (config.redis.enabled) {
    await connectRedis();
  }

  startQuotationExpiryWorker();

  const httpServer = new HTTPServer(app);
  const socketManager = new SocketManager(httpServer);
  const io = socketManager.getIO();

  setupSwagger(app);
  app.disable("x-powered-by");
  app.set("trust proxy", config.server.trustProxy ? 1 : 0);
  app.use((req, res, next) => {
    const incomingTraceId = String(req.headers["x-trace-id"] || "").trim();
    const traceId = incomingTraceId || randomUUID();
    req.traceId = traceId;
    res.setHeader("x-trace-id", traceId);
    next();
  });

  app.use("/", healthRoutes);
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
  app.use(cookieParser(config.security.cookieSecret, cookieParserOptions));

  const sessionConfig: session.SessionOptions = {
    secret: config.security.sessionSecret,
    resave: false,
    saveUninitialized: false,
    proxy: config.server.trustProxy,
    cookie: {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: config.security.cookieSameSite,
      domain: config.security.cookieDomain,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  };

  if (config.redis.enabled) {
    sessionConfig.store = new RedisStore({ client: redisClient as any });
  } else if (config.isDevelopment) {
    console.warn(
      "[session] Redis is disabled in development. Using in-memory session store."
    );
  }

  app.use(session(sessionConfig));

  app.use(passport.initialize());
  app.use(passport.session());
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
        "Apollo-Require-Preflight",
      ],
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

  app.use(ExpressMongoSanitize());
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

  app.use("/api", configureRoutes(io));
  await configureGraphQL(app);

  app.use(globalError);
  app.use(logRequest);

  return { app, httpServer };
};
