import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { z } from "zod";

type NodeEnv = "development" | "test" | "production";

type Frozen<T> = {
  readonly [K in keyof T]: T[K] extends Record<string, unknown>
  ? Frozen<T[K]>
  : T[K];
};

const LOCALHOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const NODE_ENVS: ReadonlyArray<NodeEnv> = ["development", "test", "production"];
const PROJECT_ROOT = process.cwd();
const ENV_FILE_PATH = path.resolve(PROJECT_ROOT, ".env");

const parseEnvLineMap = (filePath: string): Map<string, number> => {
  const lineMap = new Map<string, number>();
  if (!fs.existsSync(filePath)) {
    return lineMap;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=/);
    if (match) {
      lineMap.set(match[1], index + 1);
    }
  });
  return lineMap;
};

const envLineMap = parseEnvLineMap(ENV_FILE_PATH);

const lineHint = (key: string): string => {
  const line = envLineMap.get(key);
  if (line) {
    return `${ENV_FILE_PATH}:${line}`;
  }
  return `${ENV_FILE_PATH}:n/a`;
};

const throwConfigError = (key: string, message: string): never => {
  throw new Error(`[config] ${key} (${lineHint(key)}): ${message}`);
};

const parseNodeEnv = (): NodeEnv => {
  const raw = process.env.NODE_ENV?.trim();
  if (!raw) {
    throwConfigError("NODE_ENV", "Missing required environment variable");
  }
  const parsed = z.enum(NODE_ENVS as [NodeEnv, ...NodeEnv[]]).safeParse(raw);
  if (!parsed.success) {
    throwConfigError("NODE_ENV", parsed.error.issues[0].message);
  }
  return parsed.data as NodeEnv;
};

const nodeEnv = parseNodeEnv();
const isProduction = nodeEnv === "production";
const isDevelopment = nodeEnv === "development";

const parseEnv = <S extends z.ZodTypeAny>(
  key: string,
  schema: S,
  options?: {
    devDefault?: z.infer<S>;
    optional?: boolean;
    productionRequired?: boolean;
  }
): z.infer<S> | undefined => {
  const raw = process.env[key];
  const value = typeof raw === "string" ? raw.trim() : "";
  const isEmpty = value.length === 0;
  const productionRequired = options?.productionRequired ?? true;

  if (isEmpty) {
    if (!isProduction && options?.devDefault !== undefined) {
      return options.devDefault;
    }
    if (options?.optional || (!isProduction && !productionRequired)) {
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

const parseString = (
  key: string,
  options?: {
    devDefault?: string;
    optional?: boolean;
    productionRequired?: boolean;
  }
): string | undefined =>
  parseEnv(key, z.string().min(1), options);

const parseBoolean = (
  key: string,
  options?: {
    devDefault?: boolean;
    optional?: boolean;
    productionRequired?: boolean;
  }
): boolean | undefined =>
  parseEnv(key, z.enum(["true", "false"]).transform((v) => v === "true"), options);

const parsePositiveInt = (
  key: string,
  options?: {
    devDefault?: number;
    optional?: boolean;
    productionRequired?: boolean;
  }
): number | undefined =>
  parseEnv(
    key,
    z.coerce
      .number()
      .int()
      .positive(),
    options
  );

const parseUrl = (
  key: string,
  options?: {
    devDefault?: string;
    optional?: boolean;
    productionRequired?: boolean;
  }
): string | undefined =>
  parseEnv(key, z.string().url(), options);

const parseUrlOrThrow = (key: string, value: string): URL => {
  try {
    return new URL(value);
  } catch (error) {
    throwConfigError(
      key,
      `Invalid URL: ${error instanceof Error ? error.message : String(error)}`
    );
    throw new Error("[config] unreachable");
  }
};

const parseDatabaseTarget = (
  databaseUrl: string
): {
  host: string;
  port: number;
  sslMode: string | undefined;
  connectionLimit: string | undefined;
  poolTimeout: string | undefined;
  normalizedUrl: string;
} => {
  const parsedUrl = parseUrlOrThrow("DATABASE_URL", databaseUrl);

  const host = parsedUrl.hostname.trim().toLowerCase();
  const portRaw = parsedUrl.port.trim();
  const port = portRaw ? Number(portRaw) : 5432;
  if (!host) {
    throwConfigError("DATABASE_URL", "Host is required");
  }
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throwConfigError("DATABASE_URL", "Invalid port");
  }

  return {
    host,
    port,
    sslMode: parsedUrl.searchParams.get("sslmode") ?? undefined,
    connectionLimit: parsedUrl.searchParams.get("connection_limit") ?? undefined,
    poolTimeout: parsedUrl.searchParams.get("pool_timeout") ?? undefined,
    normalizedUrl: parsedUrl.toString(),
  };
};

const normalizeOrigins = (csv: string): string[] => {
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
        throwConfigError(
          "ALLOWED_ORIGINS",
          "Wildcard '*' is not allowed in production"
        );
      }
      continue;
    }

    const parsed = z.string().url().safeParse(origin);
    if (!parsed.success) {
      throwConfigError("ALLOWED_ORIGINS", `Invalid origin URL: ${origin}`);
    }
  }

  return uniqueOrigins;
};

const deepFreeze = <T extends Record<string, any>>(obj: T): Frozen<T> => {
  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    const value = obj[key];
    if (
      value &&
      (typeof value === "object" || typeof value === "function") &&
      !Object.isFrozen(value)
    ) {
      deepFreeze(value);
    }
  }
  return obj as Frozen<T>;
};

const port = parsePositiveInt("PORT") as number;
const clientDevUrl = parseUrl("CLIENT_URL_DEV") as string;
const publicApiBaseUrl = parseUrl("PUBLIC_API_BASE_URL", {
  devDefault: `http://127.0.0.1:${port}`,
}) as string;

const databaseUrl = parseString("DATABASE_URL") as string;
const directUrlRaw = parseString("DIRECT_URL", {
  optional: true,
  productionRequired: false,
});
const dbSslRequired = parseBoolean("DB_SSL_REQUIRED", {
  devDefault: false,
}) as boolean;
const dbPoolMax = parsePositiveInt("DB_POOL_MAX", {
  devDefault: 20,
}) as number;
const dbIdleTimeoutMs = parsePositiveInt("DB_IDLE_TIMEOUT_MS", {
  devDefault: 30000,
}) as number;
const dbPoolTimeoutMs = parsePositiveInt("DB_POOL_TIMEOUT_MS", {
  devDefault: 20000,
}) as number;

let dbTarget = parseDatabaseTarget(databaseUrl);
const directDbTarget = directUrlRaw
  ? parseDatabaseTarget(directUrlRaw)
  : undefined;
const dbUrl = new URL(dbTarget.normalizedUrl);

// connection_limit and pool_timeout are pgbouncer-specific parameters
// required for pooled connections (e.g. Neon free tier). Direct connections
// do not use them and should not require them.
// We still inject them if missing so Prisma respects our pool settings
// in both environments, but we no longer block production boot on them.
if (!dbTarget.connectionLimit) {
  dbUrl.searchParams.set("connection_limit", String(dbPoolMax));
}

if (!dbTarget.poolTimeout) {
  dbUrl.searchParams.set("pool_timeout", String(Math.ceil(dbPoolTimeoutMs / 1000)));
}

dbTarget = parseDatabaseTarget(dbUrl.toString());

if (isProduction && LOCALHOSTS.has(dbTarget.host)) {
  throwConfigError(
    "DATABASE_URL",
    "Production database host cannot be localhost/127.0.0.1/::1"
  );
}

// DIRECT_URL is only required when DATABASE_URL is a pgbouncer-pooled connection
// (Neon free tier uses pgbouncer).
// We no longer enforce DIRECT_URL in production — the schema.prisma no longer
// declares directUrl, so Prisma uses DATABASE_URL for both queries and migrations.
if (isProduction && directDbTarget === undefined) {
  console.log("[config] DIRECT_URL not set — using DATABASE_URL for all Prisma operations (direct connection mode).");
}

if (isProduction && directDbTarget && LOCALHOSTS.has(directDbTarget.host)) {
  throwConfigError(
    "DIRECT_URL",
    "Production direct database host cannot be localhost/127.0.0.1/::1"
  );
}

if (isProduction && !dbSslRequired) {
  throwConfigError("DB_SSL_REQUIRED", "Must be true in production");
}

// SSL is enforced via DB_SSL_REQUIRED=true and Prisma's SSL config.
// We no longer require sslmode=require in the URL string itself because
// some managed platforms provide SSL by default even when the param is omitted.
if (isProduction) {
  const sslMode = (dbTarget.sslMode || "").toLowerCase();
  if (sslMode && sslMode !== "require" && sslMode !== "verify-full") {
    throwConfigError(
      "DATABASE_URL",
      `Production database URL has an unsafe sslmode: '${sslMode}'. Use sslmode=require or omit to rely on the provider's default SSL.`
    );
  }
}

if (isProduction && directDbTarget) {
  const directSslMode = (directDbTarget.sslMode || "").toLowerCase();
  if (directSslMode !== "require") {
    throwConfigError(
      "DIRECT_URL",
      "Production DIRECT_URL must include sslmode=require"
    );
  }
}

const redisEnabled = parseBoolean("REDIS_ENABLED", {
  devDefault: true,
}) as boolean;
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
const redisTarget =
  redisEnabled && redisUrl
    ? (() => {
      const parsed = parseUrlOrThrow("REDIS_URL", redisUrl);

      const parsedPort = Number(parsed.port);
      const portValue =
        Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535
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
const platformName = (parseString("PLATFORM_NAME", {
  devDefault: "NMPL",
}) as string).trim();
const supportEmail = (parseString("SUPPORT_EMAIL", {
  devDefault: "support@local.test",
}) as string).trim();
const smtpUser = (parseString("SMTP_USER", {
  devDefault: smtpUserFallback || "dev-mailer@local.test",
}) as string).trim();
const smtpPass = (parseString("SMTP_PASS", {
  devDefault: smtpPassFallback || "dev-pass",
}) as string).trim();
const emailFrom = (parseString("EMAIL_FROM", {
  devDefault: smtpUser,
}) as string).trim();
const emailFromName = (parseString("EMAIL_FROM_NAME", {
  devDefault: `${platformName} Support`,
}) as string).trim();

const allowedOriginsRaw = parseString("ALLOWED_ORIGINS", {
  devDefault: clientDevUrl,
}) as string;
const corsOrigins = normalizeOrigins(allowedOriginsRaw);

const appConfig = {
  nodeEnv,
  isProduction,
  isDevelopment,
  isTest: nodeEnv === "test",
  dockerMode: parseBoolean("DOCKER_MODE", { devDefault: false }) as boolean,
  server: {
    port,
    publicApiBaseUrl,
    trustProxy: parseBoolean("TRUST_PROXY", { devDefault: false }) as boolean,
    bodyJsonLimit: parseString("BODY_JSON_LIMIT", { devDefault: "1mb" }) as string,
    bodyUrlEncodedLimit: parseString("BODY_URLENCODED_LIMIT", {
      devDefault: "1mb",
    }) as string,
    memoryUnhealthyThresholdMb: parsePositiveInt("MEMORY_UNHEALTHY_THRESHOLD_MB", {
      devDefault: 1024,
    }) as number,
  },
  urls: {
    clientDev: clientDevUrl,
    clientProd: parseUrl("CLIENT_URL_PROD", {
      devDefault: clientDevUrl,
    }) as string,
  },
  branding: {
    platformName,
    supportEmail,
    billingNotificationEmails: parseString("BILLING_NOTIFICATION_EMAILS", {
      devDefault: supportEmail,
    }) as string,
  },
  delivery: {
    bangaloreCityAliases: parseString("BANGALORE_CITY_ALIASES", {
      devDefault: "BANGALORE,BENGALURU",
    }) as string,
    bangaloreCharge: parsePositiveInt("BANGALORE_DELIVERY_CHARGE", {
      devDefault: 75,
    }) as number,
    pickupStoreName: parseString("PICKUP_STORE_NAME", {
      devDefault: `${platformName} Pickup Desk`,
    }) as string,
    pickupStorePhone: parseString("PICKUP_STORE_PHONE", {
      devDefault: "9999999999",
    }) as string,
    pickupStoreLine1: parseString("PICKUP_STORE_LINE1", {
      devDefault: `${platformName} Main Store`,
    }) as string,
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
    }) as string,
    pickupStoreState: parseString("PICKUP_STORE_STATE", {
      devDefault: "Karnataka",
    }) as string,
    pickupStoreCountry: parseString("PICKUP_STORE_COUNTRY", {
      devDefault: "India",
    }) as string,
    pickupStorePincode: parseString("PICKUP_STORE_PINCODE", {
      devDefault: "560001",
    }) as string,
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
    stripeCurrency: parseEnv(
      "STRIPE_CURRENCY",
      // ISO 4217 three-letter lowercase currency code — validated at startup so a
      // misconfigured value surfaces immediately rather than at the first payment.
      z.string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z]{3}$/, "Must be a valid 3-letter ISO 4217 currency code (e.g. inr, usd, eur)"),
      { devDefault: "inr" }
    ) as string,
    enableMockPayment: parseBoolean("ENABLE_MOCK_PAYMENT", {
      devDefault: true,
    }) as boolean,
  },
  sms: {
    provider: parseEnv(
      "SMS_PROVIDER",
      z.enum(["TWILIO", "LOG"]),
      {
        devDefault: "LOG",
      }
    ) as "TWILIO" | "LOG",
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
    smtpPort: parsePositiveInt("SMTP_PORT", { devDefault: 587 }) as number,
    smtpSecure: parseBoolean("SMTP_SECURE", { devDefault: false }) as boolean,
    smtpUser,
    smtpPass,
    emailService: parseString("EMAIL_SERVICE", {
      devDefault: "smtp",
    }) as string,
    from: emailFrom,
    fromName: emailFromName,
  },
  security: {
    sessionSecret: parseString("SESSION_SECRET", {
      devDefault: "dev-session-secret",
    }) as string,
    cookieSecret: parseString("COOKIE_SECRET", {
      devDefault: "dev-cookie-secret",
    }) as string,
    cookieDomain: parseString("COOKIE_DOMAIN", {
      optional: true,
      productionRequired: false,
    }),
    cookieSameSite: parseEnv("COOKIE_SAMESITE", z.enum(["lax", "strict", "none"]), {
      devDefault: "lax",
    }) as "lax" | "strict" | "none",
    helmetEnabled: parseBoolean("HELMET_ENABLED", {
      devDefault: true,
    }) as boolean,
    csp: parseString("CSP_DIRECTIVES", {
      devDefault:
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'",
    }) as string,
  },
  auth: {
    accessTokenSecret: parseString("ACCESS_TOKEN_SECRET", {
      devDefault: "dev-access-token-secret",
    }) as string,
    refreshTokenSecret: parseString("REFRESH_TOKEN_SECRET", {
      devDefault: "dev-refresh-token-secret",
    }) as string,
    accessTtlSeconds: parsePositiveInt("ACCESS_TOKEN_TTL_SECONDS", {
      devDefault: 900,
    }) as number,
    refreshAbsoluteTtlSeconds: parsePositiveInt("REFRESH_TOKEN_ABS_TTL_SECONDS", {
      devDefault: 86400,
    }) as number,
  },
  registrationOtp: {
    expirySeconds: parsePositiveInt("REGISTRATION_OTP_EXPIRY_SECONDS", {
      devDefault: 600,
    }) as number,
    resendCooldownSeconds: parsePositiveInt(
      "REGISTRATION_OTP_RESEND_COOLDOWN_SECONDS",
      { devDefault: 60 }
    ) as number,
    maxAttempts: parsePositiveInt("REGISTRATION_OTP_MAX_ATTEMPTS", {
      devDefault: 5,
    }) as number,
    phoneOtpEnabled: parseBoolean("REGISTRATION_PHONE_OTP_ENABLED", {
      devDefault: false,
    }) as boolean,
  },
  orderLifecycle: {
    reservationExpiryHours: parsePositiveInt("ORDER_RESERVATION_EXPIRY_HOURS", {
      devDefault: 48,
    }) as number,
    reservationSweepSeconds: parsePositiveInt("ORDER_RESERVATION_SWEEP_SECONDS", {
      devDefault: 60,
    }) as number,
  },
  rateLimit: {
    enabled: parseBoolean("RATE_LIMIT_ENABLED", { devDefault: true }) as boolean,
    loginMax: parsePositiveInt("RATE_LIMIT_LOGIN_MAX", { devDefault: 5 }) as number,
    otpMax: parsePositiveInt("RATE_LIMIT_OTP_MAX", { devDefault: 10 }) as number,
    orderMax: parsePositiveInt("RATE_LIMIT_ORDER_MAX", { devDefault: 8 }) as number,
  },
  cors: {
    origins: corsOrigins,
  },
  database: {
    url: dbTarget.normalizedUrl,
    directUrl: directDbTarget?.normalizedUrl,
    host: dbTarget.host,
    port: dbTarget.port,
    directHost: directDbTarget?.host ?? dbTarget.host,
    directPort: directDbTarget?.port ?? dbTarget.port,
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
    }) as string,
    parityKey: parseString("REDIS_PARITY_KEY", {
      devDefault: "config-hash",
    }) as string,
    connectTimeoutMs: parsePositiveInt("REDIS_CONNECT_TIMEOUT_MS", {
      devDefault: 5000,
    }) as number,
  },
  cache: {
    reportsTtlSeconds: parsePositiveInt("REPORTS_CACHE_TTL_SECONDS", {
      devDefault: 300,
    }) as number,
    catalogTtlSeconds: parsePositiveInt("CATALOG_CACHE_TTL_SECONDS", {
      devDefault: 120,
    }) as number,
    categoryTtlSeconds: parsePositiveInt("CATEGORY_CACHE_TTL_SECONDS", {
      devDefault: 300,
    }) as number,
  },
  diagnostics: {
    strictBuildChecks: parseBoolean("STRICT_BUILD_CHECKS", {
      devDefault: true,
    }) as boolean,
    clusterParityCheckEnabled: parseBoolean("CLUSTER_PARITY_CHECK_ENABLED", {
      devDefault: false,
    }) as boolean,
    mixedModeGuardEnabled: parseBoolean("MIXED_MODE_GUARD_ENABLED", {
      devDefault: true,
    }) as boolean,
    dockerDbHostPort: parsePositiveInt("DOCKER_DB_HOST_PORT", {
      optional: true,
      productionRequired: false,
    }),
  },
  raw: Object.freeze({ ...process.env }),
} as const;

if (isProduction && appConfig.payment.enableMockPayment) {
  throwConfigError(
    "ENABLE_MOCK_PAYMENT",
    "Production mode does not allow mock payment"
  );
}

if (appConfig.payment.stripeSecretKey && !appConfig.payment.stripeWebhookSecret) {
  throwConfigError(
    "STRIPE_WEBHOOK_SECRET",
    "Required when STRIPE_SECRET_KEY is configured"
  );
}

if (appConfig.sms.provider === "TWILIO") {
  if (
    !appConfig.sms.twilioAccountSid ||
    !appConfig.sms.twilioAuthToken ||
    !appConfig.sms.twilioFromNumber
  ) {
    throwConfigError(
      "SMS_PROVIDER",
      "TWILIO provider requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER"
    );
  }
}

if (isProduction) {
  const DEV_SECRET_DEFAULTS = new Set([
    "dev_access_token_secret_change_me",
    "dev-access-token-secret",
    "dev_refresh_token_secret_change_me",
    "dev-refresh-token-secret",
    "dev_session_secret_change_me",
    "dev-session-secret",
    "dev_cookie_secret_change_me",
    "dev-cookie-secret",
    "replace_me",
    "change_me",
  ]);

  const secretChecks: Array<[string, string | undefined]> = [
    ["ACCESS_TOKEN_SECRET", appConfig.auth.accessTokenSecret],
    ["REFRESH_TOKEN_SECRET", appConfig.auth.refreshTokenSecret],
    ["SESSION_SECRET", appConfig.security.sessionSecret],
    ["COOKIE_SECRET", appConfig.security.cookieSecret],
  ];

  for (const [key, value] of secretChecks) {
    if (value && DEV_SECRET_DEFAULTS.has(value.trim().toLowerCase())) {
      throwConfigError(
        key,
        "Production boot blocked: this key still uses a known dev/placeholder secret. Set a strong unique value."
      );
    }
  }
}

export const config = deepFreeze(appConfig);

const configHashPayload = {
  dbHost: config.database.host,
  dbPort: config.database.port,
  directDbHost: config.database.directHost,
  directDbPort: config.database.directPort,
  redisHost: config.redis.host,
  redisPort: config.redis.port,
  serverPort: config.server.port,
  corsOrigins: [...config.cors.origins].sort(),
  nodeEnv: config.nodeEnv,
};

export const configHash = createHash("sha256")
  .update(JSON.stringify(configHashPayload))
  .digest("hex");

export const isLocalAddress = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return LOCALHOSTS.has(normalized);
};

const isPrivateIpv4 = (hostname: string): boolean => {
  if (!IPV4_PATTERN.test(hostname)) {
    return false;
  }

  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [octet1, octet2] = parts;
  if (octet1 === 10) return true;
  if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return true;
  if (octet1 === 192 && octet2 === 168) return true;
  return false;
};

const isDevOriginAllowed = (origin: string): boolean => {
  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname.toLowerCase();
    if (isLocalAddress(hostname)) return true;
    if (hostname.endsWith(".local")) return true;
    if (isPrivateIpv4(hostname)) return true;
    return false;
  } catch {
    return false;
  }
};

export const isAllowedOrigin = (origin: string | undefined): boolean => {
  if (!origin) {
    return true;
  }

  if (config.cors.origins.includes("*")) {
    return true;
  }

  if (config.cors.origins.includes(origin)) {
    return true;
  }

  if (!config.isDevelopment) {
    return false;
  }

  return isDevOriginAllowed(origin);
};
