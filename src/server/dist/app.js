"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const express_1 = __importDefault(require("express"));
require("./infra/cloudinary/config");
const body_parser_1 = __importDefault(require("body-parser"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_mongo_sanitize_1 = __importDefault(require("express-mongo-sanitize"));
const hpp_1 = __importDefault(require("hpp"));
const morgan_1 = __importDefault(require("morgan"));
const logger_1 = __importDefault(require("./infra/winston/logger"));
const compression_1 = __importDefault(require("compression"));
const passport_1 = __importDefault(require("passport"));
const express_session_1 = __importDefault(require("express-session"));
const connect_redis_1 = require("connect-redis");
const redis_1 = __importStar(require("./infra/cache/redis"));
const passport_2 = __importDefault(require("./infra/passport/passport"));
const constants_1 = require("./shared/constants");
const globalError_1 = __importDefault(require("./shared/errors/globalError"));
const logRequest_1 = require("./shared/middlewares/logRequest");
const routes_1 = require("./routes");
const graphql_1 = require("./graphql");
const webhook_routes_1 = __importDefault(require("./modules/webhook/webhook.routes"));
const health_routes_1 = __importDefault(require("./routes/health.routes"));
const http_1 = require("http");
const socket_1 = require("@/infra/socket/socket");
const database_config_1 = require("./infra/database/database.config");
const swagger_1 = require("./docs/swagger");
const quotationExpiry_worker_1 = require("./modules/transaction/quotationExpiry.worker");
const config_1 = require("@/config");
const crypto_1 = require("crypto");
const parseCspDirectives = (value) => {
    const directives = value
        .split(";")
        .map((directive) => directive.trim())
        .filter(Boolean);
    if (directives.length === 0) {
        throw new Error("[app] CSP_DIRECTIVES is empty or invalid");
    }
    const parsed = {};
    for (const directive of directives) {
        const [name, ...items] = directive.split(" ").map((token) => token.trim());
        if (!name) {
            throw new Error(`[app] Invalid CSP directive segment: ${directive}`);
        }
        parsed[name] = items.length > 0 ? items : ["'none'"];
    }
    return parsed;
};
const createApp = () => __awaiter(void 0, void 0, void 0, function* () {
    const app = (0, express_1.default)();
    yield (0, database_config_1.connectDB)();
    if (config_1.config.redis.enabled) {
        yield (0, redis_1.connectRedis)();
    }
    (0, quotationExpiry_worker_1.startQuotationExpiryWorker)();
    const httpServer = new http_1.Server(app);
    const socketManager = new socket_1.SocketManager(httpServer);
    const io = socketManager.getIO();
    (0, swagger_1.setupSwagger)(app);
    app.disable("x-powered-by");
    app.set("trust proxy", config_1.config.server.trustProxy ? 1 : 0);
    app.use((req, res, next) => {
        const incomingTraceId = String(req.headers["x-trace-id"] || "").trim();
        const traceId = incomingTraceId || (0, crypto_1.randomUUID)();
        req.traceId = traceId;
        res.setHeader("x-trace-id", traceId);
        next();
    });
    app.use("/", health_routes_1.default);
    app.use("/api/v1/webhook", body_parser_1.default.raw({ type: "application/json", limit: config_1.config.server.bodyJsonLimit }), webhook_routes_1.default);
    app.use(express_1.default.json({ limit: config_1.config.server.bodyJsonLimit }));
    app.use(body_parser_1.default.urlencoded({
        extended: true,
        limit: config_1.config.server.bodyUrlEncodedLimit,
        parameterLimit: 500,
    }));
    app.use((0, cookie_parser_1.default)(config_1.config.security.cookieSecret, constants_1.cookieParserOptions));
    const sessionConfig = {
        secret: config_1.config.security.sessionSecret,
        resave: false,
        saveUninitialized: false,
        proxy: config_1.config.server.trustProxy,
        cookie: {
            httpOnly: true,
            secure: config_1.config.isProduction,
            sameSite: config_1.config.security.cookieSameSite,
            domain: config_1.config.security.cookieDomain,
            maxAge: 1000 * 60 * 60 * 24 * 7,
        },
    };
    if (config_1.config.redis.enabled) {
        sessionConfig.store = new connect_redis_1.RedisStore({ client: redis_1.default });
    }
    else if (config_1.config.isDevelopment) {
        console.warn("[session] Redis is disabled in development. Using in-memory session store.");
    }
    app.use((0, express_session_1.default)(sessionConfig));
    app.use(passport_1.default.initialize());
    app.use(passport_1.default.session());
    (0, passport_2.default)();
    app.use((req, res, next) => {
        if (req.headers["access-control-request-private-network"] === "true") {
            res.setHeader("Access-Control-Allow-Private-Network", "true");
        }
        next();
    });
    app.use((0, cors_1.default)({
        origin: (origin, callback) => {
            if ((0, config_1.isAllowedOrigin)(origin)) {
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
    }));
    if (config_1.config.isProduction && config_1.config.security.helmetEnabled) {
        app.use((0, helmet_1.default)({
            contentSecurityPolicy: {
                directives: parseCspDirectives(config_1.config.security.csp),
            },
        }));
        app.use(helmet_1.default.frameguard({ action: "deny" }));
        app.use(helmet_1.default.hsts({
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
        }));
        app.use(helmet_1.default.referrerPolicy({ policy: "no-referrer" }));
        app.use(helmet_1.default.permittedCrossDomainPolicies());
        app.use((_req, res, next) => {
            res.setHeader("X-Frame-Options", "DENY");
            next();
        });
    }
    app.use((0, express_mongo_sanitize_1.default)());
    app.use((0, hpp_1.default)({
        whitelist: ["sort", "filter", "fields", "page", "limit"],
    }));
    app.use((0, morgan_1.default)("combined", {
        stream: {
            write: (message) => logger_1.default.info(message.trim()),
        },
    }));
    app.use((0, compression_1.default)());
    app.use("/api", (0, routes_1.configureRoutes)(io));
    yield (0, graphql_1.configureGraphQL)(app);
    app.use(globalError_1.default);
    app.use(logRequest_1.logRequest);
    return { app, httpServer };
});
exports.createApp = createApp;
