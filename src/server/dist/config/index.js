"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAllowedOrigin = exports.isLocalAddress = exports.configHash = exports.config = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const zod_1 = require("zod");
const LOCALHOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const NODE_ENVS = ["development", "test", "production"];
const PROJECT_ROOT = process.cwd();
const ENV_FILE_PATH = path_1.default.resolve(PROJECT_ROOT, ".env");
const ENV_EXAMPLE_PATH = path_1.default.resolve(PROJECT_ROOT, ".env.example");
const parseEnvLineMap = (filePath) => {
    const lineMap = new Map();
    if (!fs_1.default.existsSync(filePath)) {
        return lineMap;
    }
    const lines = fs_1.default.readFileSync(filePath, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=/);
        if (match) {
            lineMap.set(match[1], index + 1);
        }
    });
    return lineMap;
};
const envLineMap = parseEnvLineMap(ENV_FILE_PATH);
const exampleLineMap = parseEnvLineMap(ENV_EXAMPLE_PATH);
const lineHint = (key) => {
    const line = envLineMap.get(key);
    if (line) {
        return `${ENV_FILE_PATH}:${line}`;
    }
    const exampleLine = exampleLineMap.get(key);
    if (exampleLine) {
        return `${ENV_EXAMPLE_PATH}:${exampleLine}`;
    }
    return `${ENV_FILE_PATH}:n/a`;
};
const throwConfigError = (key, message) => {
    throw new Error(`[config] ${key} (${lineHint(key)}): ${message}`);
};
const parseNodeEnv = () => {
    var _a;
    const raw = (_a = process.env.NODE_ENV) === null || _a === void 0 ? void 0 : _a.trim();
    if (!raw) {
        throwConfigError("NODE_ENV", "Missing required environment variable");
    }
    const parsed = zod_1.z.enum(NODE_ENVS).safeParse(raw);
    if (!parsed.success) {
        throwConfigError("NODE_ENV", parsed.error.issues[0].message);
    }
    return parsed.data;
};
const nodeEnv = parseNodeEnv();
const isProduction = nodeEnv === "production";
const isDevelopment = nodeEnv === "development";
const parseEnv = (key, schema, options) => {
    var _a;
    const raw = process.env[key];
    const value = typeof raw === "string" ? raw.trim() : "";
    const isEmpty = value.length === 0;
    const productionRequired = (_a = options === null || options === void 0 ? void 0 : options.productionRequired) !== null && _a !== void 0 ? _a : true;
    if (isEmpty) {
        if (!isProduction && (options === null || options === void 0 ? void 0 : options.devDefault) !== undefined) {
            return options.devDefault;
        }
        if ((options === null || options === void 0 ? void 0 : options.optional) || (!isProduction && !productionRequired)) {
            return undefined;
        }
        throwConfigError(key, "Missing required environment variable");
    }
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
        throwConfigError(key, parsed.error.issues[0].message);
    }
    return parsed.data;
};
const parseString = (key, options) => parseEnv(key, zod_1.z.string().min(1), options);
const parseBoolean = (key, options) => parseEnv(key, zod_1.z.enum(["true", "false"]).transform((v) => v === "true"), options);
const parsePositiveInt = (key, options) => parseEnv(key, zod_1.z.coerce
    .number()
    .int()
    .positive(), options);
const parseUrl = (key, options) => parseEnv(key, zod_1.z.string().url(), options);
const parseUrlOrThrow = (key, value) => {
    try {
        return new URL(value);
    }
    catch (error) {
        throwConfigError(key, `Invalid URL: ${error instanceof Error ? error.message : String(error)}`);
        throw new Error("[config] unreachable");
    }
};
const parseDatabaseTarget = (databaseUrl) => {
    var _a, _b, _c;
    const parsedUrl = parseUrlOrThrow("DATABASE_URL", databaseUrl);
    const host = parsedUrl.hostname.trim().toLowerCase();
    const portRaw = parsedUrl.port.trim();
    if (!portRaw) {
        throwConfigError("DATABASE_URL", "Explicit database port is required");
    }
    const port = Number(portRaw);
    if (!host) {
        throwConfigError("DATABASE_URL", "Host is required");
    }
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
        throwConfigError("DATABASE_URL", "Invalid port");
    }
    return {
        host,
        port,
        sslMode: (_a = parsedUrl.searchParams.get("sslmode")) !== null && _a !== void 0 ? _a : undefined,
        connectionLimit: (_b = parsedUrl.searchParams.get("connection_limit")) !== null && _b !== void 0 ? _b : undefined,
        poolTimeout: (_c = parsedUrl.searchParams.get("pool_timeout")) !== null && _c !== void 0 ? _c : undefined,
        normalizedUrl: parsedUrl.toString(),
    };
};
const normalizeOrigins = (csv) => {
    const origins = csv
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
    if (origins.length === 0) {
        throwConfigError("ALLOWED_ORIGINS", "At least one origin is required");
    }
    const uniqueOrigins = [...new Set(origins)];
    for (const origin of uniqueOrigins) {
        if (origin === "*") {
            if (isProduction) {
                throwConfigError("ALLOWED_ORIGINS", "Wildcard '*' is not allowed in production");
            }
            continue;
        }
        const parsed = zod_1.z.string().url().safeParse(origin);
        if (!parsed.success) {
            throwConfigError("ALLOWED_ORIGINS", `Invalid origin URL: ${origin}`);
        }
    }
    return uniqueOrigins;
};
const deepFreeze = (obj) => {
    Object.freeze(obj);
    for (const key of Object.getOwnPropertyNames(obj)) {
        const value = obj[key];
        if (value &&
            (typeof value === "object" || typeof value === "function") &&
            !Object.isFrozen(value)) {
            deepFreeze(value);
        }
    }
    return obj;
};
const port = parsePositiveInt("PORT");
const clientDevUrl = parseUrl("CLIENT_URL_DEV");
const publicApiBaseUrl = parseUrl("PUBLIC_API_BASE_URL", {
    devDefault: `http://127.0.0.1:${port}`,
});
const databaseUrl = parseString("DATABASE_URL");
const dbSslRequired = parseBoolean("DB_SSL_REQUIRED", {
    devDefault: false,
});
const dbPoolMax = parsePositiveInt("DB_POOL_MAX", {
    devDefault: 20,
});
const dbIdleTimeoutMs = parsePositiveInt("DB_IDLE_TIMEOUT_MS", {
    devDefault: 30000,
});
const dbPoolTimeoutMs = parsePositiveInt("DB_POOL_TIMEOUT_MS", {
    devDefault: 20000,
});
let dbTarget = parseDatabaseTarget(databaseUrl);
const dbUrl = new URL(dbTarget.normalizedUrl);
if (!dbTarget.connectionLimit) {
    if (isProduction) {
        throwConfigError("DATABASE_URL", "Missing connection_limit query parameter in production");
    }
    dbUrl.searchParams.set("connection_limit", String(dbPoolMax));
}
if (!dbTarget.poolTimeout) {
    if (isProduction) {
        throwConfigError("DATABASE_URL", "Missing pool_timeout query parameter in production");
    }
    dbUrl.searchParams.set("pool_timeout", String(Math.ceil(dbPoolTimeoutMs / 1000)));
}
dbTarget = parseDatabaseTarget(dbUrl.toString());
if (isProduction && LOCALHOSTS.has(dbTarget.host)) {
    throwConfigError("DATABASE_URL", "Production database host cannot be localhost/127.0.0.1/::1");
}
if (isProduction && !dbSslRequired) {
    throwConfigError("DB_SSL_REQUIRED", "Must be true in production");
}
if (isProduction) {
    const sslMode = (dbTarget.sslMode || "").toLowerCase();
    if (sslMode !== "require") {
        throwConfigError("DATABASE_URL", "Production database URL must include sslmode=require");
    }
}
const redisEnabled = parseBoolean("REDIS_ENABLED", {
    devDefault: true,
});
const redisUrlRaw = parseString("REDIS_URL", {
    optional: true,
    productionRequired: false,
});
if (redisEnabled && !redisUrlRaw) {
    if (isProduction) {
        throwConfigError("REDIS_URL", "Required when REDIS_ENABLED=true in production");
    }
}
if (isProduction && !redisEnabled) {
    throwConfigError("REDIS_ENABLED", "Must be true in production");
}
const redisUrl = redisUrlRaw || undefined;
const redisTarget = redisEnabled && redisUrl
    ? (() => {
        const parsed = parseUrlOrThrow("REDIS_URL", redisUrl);
        const parsedPort = Number(parsed.port);
        const portValue = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535
            ? parsedPort
            : undefined;
        if (!portValue) {
            throwConfigError("REDIS_URL", "Explicit Redis port is required in REDIS_URL");
        }
        return {
            host: parsed.hostname.toLowerCase(),
            port: portValue,
        };
    })()
    : { host: "disabled", port: 0 };
const smtpUserFallback = parseString("EMAIL_USER", {
    optional: true,
    productionRequired: false,
});
const smtpPassFallback = parseString("EMAIL_PASS", {
    optional: true,
    productionRequired: false,
});
const platformName = parseString("PLATFORM_NAME", {
    devDefault: "NMPL",
}).trim();
const supportEmail = parseString("SUPPORT_EMAIL", {
    devDefault: "support@local.test",
}).trim();
const smtpUser = parseString("SMTP_USER", {
    devDefault: smtpUserFallback || "dev-mailer@local.test",
}).trim();
const smtpPass = parseString("SMTP_PASS", {
    devDefault: smtpPassFallback || "dev-pass",
}).trim();
const emailFrom = parseString("EMAIL_FROM", {
    devDefault: smtpUser,
}).trim();
const emailFromName = parseString("EMAIL_FROM_NAME", {
    devDefault: `${platformName} Support`,
}).trim();
const allowedOriginsRaw = parseString("ALLOWED_ORIGINS", {
    devDefault: clientDevUrl,
});
const corsOrigins = normalizeOrigins(allowedOriginsRaw);
const appConfig = {
    nodeEnv,
    isProduction,
    isDevelopment,
    isTest: nodeEnv === "test",
    dockerMode: parseBoolean("DOCKER_MODE", { devDefault: false }),
    server: {
        port,
        publicApiBaseUrl,
        trustProxy: parseBoolean("TRUST_PROXY", { devDefault: false }),
        bodyJsonLimit: parseString("BODY_JSON_LIMIT", { devDefault: "1mb" }),
        bodyUrlEncodedLimit: parseString("BODY_URLENCODED_LIMIT", {
            devDefault: "1mb",
        }),
        memoryUnhealthyThresholdMb: parsePositiveInt("MEMORY_UNHEALTHY_THRESHOLD_MB", {
            devDefault: 512,
        }),
    },
    urls: {
        clientDev: clientDevUrl,
        clientProd: parseUrl("CLIENT_URL_PROD", {
            devDefault: clientDevUrl,
        }),
    },
    branding: {
        platformName,
        supportEmail,
        billingNotificationEmails: parseString("BILLING_NOTIFICATION_EMAILS", {
            devDefault: supportEmail,
        }),
    },
    delivery: {
        bangaloreCityAliases: parseString("BANGALORE_CITY_ALIASES", {
            devDefault: "BANGALORE,BENGALURU",
        }),
        bangaloreCharge: parsePositiveInt("BANGALORE_DELIVERY_CHARGE", {
            devDefault: 75,
        }),
        pickupStoreName: parseString("PICKUP_STORE_NAME", {
            devDefault: `${platformName} Pickup Desk`,
        }),
        pickupStorePhone: parseString("PICKUP_STORE_PHONE", {
            devDefault: "9999999999",
        }),
        pickupStoreLine1: parseString("PICKUP_STORE_LINE1", {
            devDefault: `${platformName} Main Store`,
        }),
        pickupStoreLine2: parseString("PICKUP_STORE_LINE2", {
            optional: true,
            productionRequired: false,
        }),
        pickupStoreLandmark: parseString("PICKUP_STORE_LANDMARK", {
            optional: true,
            productionRequired: false,
        }),
        pickupStoreCity: parseString("PICKUP_STORE_CITY", {
            devDefault: "Bangalore",
        }),
        pickupStoreState: parseString("PICKUP_STORE_STATE", {
            devDefault: "Karnataka",
        }),
        pickupStoreCountry: parseString("PICKUP_STORE_COUNTRY", {
            devDefault: "India",
        }),
        pickupStorePincode: parseString("PICKUP_STORE_PINCODE", {
            devDefault: "560001",
        }),
    },
    payment: {
        stripeSecretKey: parseString("STRIPE_SECRET_KEY", {
            optional: true,
            productionRequired: false,
        }),
        stripeWebhookSecret: parseString("STRIPE_WEBHOOK_SECRET", {
            optional: true,
            productionRequired: false,
        }),
        stripeCurrency: parseString("STRIPE_CURRENCY", {
            devDefault: "inr",
        }),
        enableMockPayment: parseBoolean("ENABLE_MOCK_PAYMENT", {
            devDefault: true,
        }),
    },
    sms: {
        provider: parseEnv("SMS_PROVIDER", zod_1.z.enum(["TWILIO", "LOG"]), {
            devDefault: "LOG",
        }),
        twilioAccountSid: parseString("TWILIO_ACCOUNT_SID", {
            optional: true,
            productionRequired: false,
        }),
        twilioAuthToken: parseString("TWILIO_AUTH_TOKEN", {
            optional: true,
            productionRequired: false,
        }),
        twilioFromNumber: parseString("TWILIO_FROM_NUMBER", {
            optional: true,
            productionRequired: false,
        }),
    },
    email: {
        smtpHost: parseString("SMTP_HOST", {
            optional: true,
            productionRequired: false,
        }),
        smtpPort: parsePositiveInt("SMTP_PORT", { devDefault: 587 }),
        smtpSecure: parseBoolean("SMTP_SECURE", { devDefault: false }),
        smtpUser,
        smtpPass,
        emailService: parseString("EMAIL_SERVICE", {
            devDefault: "smtp",
        }),
        from: emailFrom,
        fromName: emailFromName,
    },
    security: {
        sessionSecret: parseString("SESSION_SECRET", {
            devDefault: "dev-session-secret",
        }),
        cookieSecret: parseString("COOKIE_SECRET", {
            devDefault: "dev-cookie-secret",
        }),
        cookieDomain: parseString("COOKIE_DOMAIN", {
            optional: true,
            productionRequired: false,
        }),
        cookieSameSite: parseEnv("COOKIE_SAMESITE", zod_1.z.enum(["lax", "strict", "none"]), {
            devDefault: "lax",
        }),
        helmetEnabled: parseBoolean("HELMET_ENABLED", {
            devDefault: true,
        }),
        csp: parseString("CSP_DIRECTIVES", {
            devDefault: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'",
        }),
    },
    auth: {
        accessTokenSecret: parseString("ACCESS_TOKEN_SECRET", {
            devDefault: "dev-access-token-secret",
        }),
        refreshTokenSecret: parseString("REFRESH_TOKEN_SECRET", {
            devDefault: "dev-refresh-token-secret",
        }),
        accessTtlSeconds: parsePositiveInt("ACCESS_TOKEN_TTL_SECONDS", {
            devDefault: 900,
        }),
        refreshAbsoluteTtlSeconds: parsePositiveInt("REFRESH_TOKEN_ABS_TTL_SECONDS", {
            devDefault: 86400,
        }),
    },
    registrationOtp: {
        expirySeconds: parsePositiveInt("REGISTRATION_OTP_EXPIRY_SECONDS", {
            devDefault: 600,
        }),
        resendCooldownSeconds: parsePositiveInt("REGISTRATION_OTP_RESEND_COOLDOWN_SECONDS", { devDefault: 60 }),
        maxAttempts: parsePositiveInt("REGISTRATION_OTP_MAX_ATTEMPTS", {
            devDefault: 5,
        }),
        phoneOtpEnabled: parseBoolean("REGISTRATION_PHONE_OTP_ENABLED", {
            devDefault: false,
        }),
    },
    orderLifecycle: {
        reservationExpiryHours: parsePositiveInt("ORDER_RESERVATION_EXPIRY_HOURS", {
            devDefault: 48,
        }),
        reservationSweepSeconds: parsePositiveInt("ORDER_RESERVATION_SWEEP_SECONDS", {
            devDefault: 60,
        }),
    },
    rateLimit: {
        enabled: parseBoolean("RATE_LIMIT_ENABLED", { devDefault: true }),
        loginMax: parsePositiveInt("RATE_LIMIT_LOGIN_MAX", { devDefault: 5 }),
        otpMax: parsePositiveInt("RATE_LIMIT_OTP_MAX", { devDefault: 10 }),
        orderMax: parsePositiveInt("RATE_LIMIT_ORDER_MAX", { devDefault: 8 }),
    },
    cors: {
        origins: corsOrigins,
    },
    database: {
        url: dbTarget.normalizedUrl,
        host: dbTarget.host,
        port: dbTarget.port,
        sslRequired: dbSslRequired,
        poolMax: dbPoolMax,
        idleTimeoutMs: dbIdleTimeoutMs,
        poolTimeoutMs: dbPoolTimeoutMs,
    },
    redis: {
        enabled: redisEnabled,
        url: redisUrl,
        host: redisTarget.host,
        port: redisTarget.port,
        namespace: parseString("REDIS_NAMESPACE", {
            devDefault: "ecommerce",
        }),
        parityKey: parseString("REDIS_PARITY_KEY", {
            devDefault: "config-hash",
        }),
        connectTimeoutMs: parsePositiveInt("REDIS_CONNECT_TIMEOUT_MS", {
            devDefault: 5000,
        }),
    },
    cache: {
        reportsTtlSeconds: parsePositiveInt("REPORTS_CACHE_TTL_SECONDS", {
            devDefault: 300,
        }),
    },
    diagnostics: {
        strictBuildChecks: parseBoolean("STRICT_BUILD_CHECKS", {
            devDefault: true,
        }),
        clusterParityCheckEnabled: parseBoolean("CLUSTER_PARITY_CHECK_ENABLED", {
            devDefault: false,
        }),
        mixedModeGuardEnabled: parseBoolean("MIXED_MODE_GUARD_ENABLED", {
            devDefault: true,
        }),
        dockerDbHostPort: parsePositiveInt("DOCKER_DB_HOST_PORT", {
            optional: true,
            productionRequired: false,
        }),
    },
    raw: Object.freeze(Object.assign({}, process.env)),
};
if (isProduction && appConfig.payment.enableMockPayment) {
    throwConfigError("ENABLE_MOCK_PAYMENT", "Production mode does not allow mock payment");
}
if (appConfig.payment.stripeSecretKey && !appConfig.payment.stripeWebhookSecret) {
    throwConfigError("STRIPE_WEBHOOK_SECRET", "Required when STRIPE_SECRET_KEY is configured");
}
if (appConfig.sms.provider === "TWILIO") {
    if (!appConfig.sms.twilioAccountSid ||
        !appConfig.sms.twilioAuthToken ||
        !appConfig.sms.twilioFromNumber) {
        throwConfigError("SMS_PROVIDER", "TWILIO provider requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER");
    }
}
exports.config = deepFreeze(appConfig);
const configHashPayload = {
    dbHost: exports.config.database.host,
    dbPort: exports.config.database.port,
    redisHost: exports.config.redis.host,
    redisPort: exports.config.redis.port,
    serverPort: exports.config.server.port,
    corsOrigins: [...exports.config.cors.origins].sort(),
    nodeEnv: exports.config.nodeEnv,
};
exports.configHash = (0, crypto_1.createHash)("sha256")
    .update(JSON.stringify(configHashPayload))
    .digest("hex");
const isLocalAddress = (value) => {
    const normalized = value.trim().toLowerCase();
    return LOCALHOSTS.has(normalized);
};
exports.isLocalAddress = isLocalAddress;
const isAllowedOrigin = (origin) => {
    if (!origin) {
        return true;
    }
    if (exports.config.cors.origins.includes("*")) {
        return true;
    }
    if (exports.config.cors.origins.includes(origin)) {
        return true;
    }
    if (!exports.config.isDevelopment) {
        return false;
    }
    try {
        const parsed = new URL(origin);
        return (0, exports.isLocalAddress)(parsed.hostname);
    }
    catch (_a) {
        return false;
    }
};
exports.isAllowedOrigin = isAllowedOrigin;
