"use strict";
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
exports.assertResourceGuards = exports.printStartupDiagnostics = exports.assertClusterParity = exports.assertApiPortParity = exports.assertMixedModeMismatch = exports.assertMigrationsApplied = exports.assertPortAvailable = void 0;
const net_1 = __importDefault(require("net"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const config_1 = require("@/config");
const redis_1 = __importDefault(require("@/infra/cache/redis"));
const PRISMA_STATUS_OK_PATTERNS = [
    "Database schema is up to date",
    "No pending migrations",
    "Already in sync",
];
const runPrismaMigrateStatus = () => {
    const serverRoot = path_1.default.resolve(__dirname, "..", "..");
    const command = process.platform === "win32" ? "npx.cmd" : "npx";
    const result = (0, child_process_1.spawnSync)(command, ["prisma", "migrate", "status", "--schema", "./prisma/schema.prisma"], {
        cwd: serverRoot,
        env: config_1.config.raw,
        encoding: "utf8",
        stdio: "pipe",
        timeout: 25000,
    });
    const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
    const statusOk = result.status === 0;
    const textIndicatesOk = PRISMA_STATUS_OK_PATTERNS.some((pattern) => output.includes(pattern));
    return {
        output,
        ok: statusOk || textIndicatesOk,
    };
};
const probeTcpPort = (host, port, timeoutMs) => new Promise((resolve) => {
    const socket = new net_1.default.Socket();
    let settled = false;
    const done = (isOpen) => {
        if (settled) {
            return;
        }
        settled = true;
        socket.destroy();
        resolve(isOpen);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
});
const assertPortAvailable = () => __awaiter(void 0, void 0, void 0, function* () {
    const inUse = yield probeTcpPort("127.0.0.1", config_1.config.server.port, 750);
    if (!inUse) {
        return;
    }
    const message = `[preflight] Port collision detected on ${config_1.config.server.port}. ${config_1.config.isProduction
        ? "Production boot blocked."
        : "Development boot blocked. Stop existing process or change PORT."}`;
    throw new Error(message);
});
exports.assertPortAvailable = assertPortAvailable;
const assertMigrationsApplied = () => {
    const migrationStatus = runPrismaMigrateStatus();
    if (!migrationStatus.ok) {
        throw new Error(`[preflight] Migration integrity check failed. Boot aborted.\n${migrationStatus.output}`);
    }
};
exports.assertMigrationsApplied = assertMigrationsApplied;
const assertMixedModeMismatch = () => __awaiter(void 0, void 0, void 0, function* () {
    if (!config_1.config.diagnostics.mixedModeGuardEnabled || config_1.config.dockerMode) {
        return;
    }
    const dockerDbHostPort = config_1.config.diagnostics.dockerDbHostPort;
    if (!dockerDbHostPort) {
        return;
    }
    const dockerDbPortOpen = yield probeTcpPort("127.0.0.1", dockerDbHostPort, 500);
    const dbConfiguredForDockerPort = (0, config_1.isLocalAddress)(config_1.config.database.host) && config_1.config.database.port === dockerDbHostPort;
    if (dockerDbPortOpen && !dbConfiguredForDockerPort) {
        throw new Error(`[preflight] Mixed mode detected: Docker PostgreSQL appears active on 127.0.0.1:${dockerDbHostPort}, but DATABASE_URL points elsewhere. Abort boot.`);
    }
});
exports.assertMixedModeMismatch = assertMixedModeMismatch;
const resolveUrlPort = (urlValue) => {
    const parsed = new URL(urlValue);
    if (parsed.port) {
        return Number(parsed.port);
    }
    return parsed.protocol === "https:" ? 443 : 80;
};
const assertApiPortParity = () => {
    const configuredApiPort = resolveUrlPort(config_1.config.server.publicApiBaseUrl);
    const boundPort = config_1.config.server.port;
    if (configuredApiPort === boundPort) {
        return;
    }
    const message = `[preflight] API port mismatch: PUBLIC_API_BASE_URL=${config_1.config.server.publicApiBaseUrl} ` +
        `resolves to ${configuredApiPort} but PORT=${boundPort}.`;
    if (config_1.config.isProduction) {
        throw new Error(`${message} Production boot blocked.`);
    }
    console.warn(`${message} Development boot continues for diagnostics.`);
};
exports.assertApiPortParity = assertApiPortParity;
const assertClusterParity = () => __awaiter(void 0, void 0, void 0, function* () {
    if (!config_1.config.diagnostics.clusterParityCheckEnabled) {
        return;
    }
    if (!config_1.config.redis.enabled) {
        throw new Error("[preflight] CLUSTER_PARITY_CHECK_ENABLED=true requires REDIS_ENABLED=true");
    }
    const key = `${config_1.config.redis.namespace}:${config_1.config.redis.parityKey}:${config_1.config.nodeEnv}`;
    const current = yield redis_1.default.get(key);
    if (current && current !== config_1.configHash) {
        throw new Error("[preflight] Configuration parity hash mismatch across instances. Boot aborted.");
    }
    if (!current) {
        yield redis_1.default.set(key, config_1.configHash, "EX", 3600);
    }
});
exports.assertClusterParity = assertClusterParity;
const printStartupDiagnostics = () => {
    const corsOrigins = config_1.config.cors.origins.join(", ");
    const block = [
        "================ SYSTEM STATE ================",
        `Environment: ${config_1.config.nodeEnv}`,
        `Server Port: ${config_1.config.server.port}`,
        `Database Host: ${config_1.config.database.host}`,
        `Database Port: ${config_1.config.database.port}`,
        `Redis Host: ${config_1.config.redis.host}`,
        `CORS Origins: ${corsOrigins}`,
        `Docker Mode: ${String(config_1.config.dockerMode)}`,
        "Migration Status: verified",
        `Config Hash: ${config_1.configHash}`,
        "=============================================",
    ];
    console.log(block.join("\n"));
};
exports.printStartupDiagnostics = printStartupDiagnostics;
const assertResourceGuards = () => {
    const maxListeners = process.getMaxListeners();
    if (!Number.isFinite(maxListeners) || maxListeners <= 0) {
        throw new Error("[preflight] Resource guard failed: process max listeners must be finite and > 0.");
    }
    if (maxListeners > 50) {
        throw new Error(`[preflight] Resource guard failed: max listeners (${maxListeners}) exceeds safe threshold (50).`);
    }
};
exports.assertResourceGuards = assertResourceGuards;
