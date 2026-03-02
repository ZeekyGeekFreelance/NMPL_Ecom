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
exports.isRedisRuntimeEnabled = exports.pingRedis = exports.disconnectRedis = exports.connectRedis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("@/config");
const nowMs = () => Date.now();
class InMemoryRedisShim {
    constructor() {
        this.records = new Map();
        this.status = "ready";
    }
    on(..._args) {
        return this;
    }
    getRecord(key) {
        const record = this.records.get(key);
        if (!record) {
            return null;
        }
        if (record.expiresAt !== null && record.expiresAt <= nowMs()) {
            this.records.delete(key);
            return null;
        }
        return record;
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            this.status = "ready";
        });
    }
    ping() {
        return __awaiter(this, void 0, void 0, function* () {
            return "PONG";
        });
    }
    quit() {
        return __awaiter(this, void 0, void 0, function* () {
            this.status = "end";
            this.records.clear();
        });
    }
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            return (_b = (_a = this.getRecord(key)) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : null;
        });
    }
    set(key, value, ...args) {
        return __awaiter(this, void 0, void 0, function* () {
            let ttlSeconds = null;
            if (args.length >= 2 && String(args[0]).toUpperCase() === "EX") {
                const parsed = Number(args[1]);
                if (Number.isFinite(parsed) && parsed > 0) {
                    ttlSeconds = parsed;
                }
            }
            this.records.set(key, {
                value,
                expiresAt: ttlSeconds === null ? null : nowMs() + ttlSeconds * 1000,
            });
            return "OK";
        });
    }
    setex(key, ttlSeconds, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
                throw new Error("[redis-shim] setex requires a positive TTL");
            }
            this.records.set(key, {
                value,
                expiresAt: nowMs() + ttlSeconds * 1000,
            });
            return "OK";
        });
    }
    del(...keys) {
        return __awaiter(this, void 0, void 0, function* () {
            let deleted = 0;
            for (const key of keys) {
                if (this.records.delete(key)) {
                    deleted += 1;
                }
            }
            return deleted;
        });
    }
    ttl(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const record = this.getRecord(key);
            if (!record) {
                return -2;
            }
            if (record.expiresAt === null) {
                return -1;
            }
            const seconds = Math.ceil((record.expiresAt - nowMs()) / 1000);
            return seconds > 0 ? seconds : -2;
        });
    }
    incr(key) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const current = this.getRecord(key);
            const parsed = Number((_a = current === null || current === void 0 ? void 0 : current.value) !== null && _a !== void 0 ? _a : "0");
            const next = (Number.isFinite(parsed) ? parsed : 0) + 1;
            const expiresAt = (_b = current === null || current === void 0 ? void 0 : current.expiresAt) !== null && _b !== void 0 ? _b : null;
            this.records.set(key, {
                value: String(next),
                expiresAt,
            });
            return next;
        });
    }
    expire(key, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            const current = this.getRecord(key);
            if (!current) {
                return 0;
            }
            if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
                throw new Error("[redis-shim] expire requires a positive TTL");
            }
            this.records.set(key, {
                value: current.value,
                expiresAt: nowMs() + ttlSeconds * 1000,
            });
            return 1;
        });
    }
    multi() {
        const keysToDelete = [];
        const command = {
            del: (key) => {
                keysToDelete.push(key);
                return command;
            },
            exec: () => __awaiter(this, void 0, void 0, function* () {
                yield this.del(...keysToDelete);
                return [];
            }),
        };
        return command;
    }
}
const useRedis = config_1.config.redis.enabled;
if (config_1.config.isProduction && !useRedis) {
    throw new Error("[redis] Redis must be enabled in production.");
}
const redis = useRedis
    ? new ioredis_1.default(config_1.config.redis.url, {
        lazyConnect: true,
        connectTimeout: config_1.config.redis.connectTimeoutMs,
        maxRetriesPerRequest: config_1.config.isProduction ? 0 : 1,
        retryStrategy: () => null,
    })
    : new InMemoryRedisShim();
redis.on("connect", () => {
    if (config_1.config.isDevelopment && useRedis) {
        console.log("Connected to Redis");
    }
});
redis.on("error", (err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[redis] ${message}`);
});
const connectRedis = () => __awaiter(void 0, void 0, void 0, function* () {
    if (!useRedis) {
        if (config_1.config.isDevelopment) {
            console.warn("[redis] REDIS_ENABLED=false in development. Using in-memory cache/session compatibility shim.");
        }
        return;
    }
    yield redis.connect();
    yield redis.ping();
});
exports.connectRedis = connectRedis;
const disconnectRedis = () => __awaiter(void 0, void 0, void 0, function* () {
    if (redis.status === "end") {
        return;
    }
    yield redis.quit();
});
exports.disconnectRedis = disconnectRedis;
const pingRedis = () => __awaiter(void 0, void 0, void 0, function* () {
    if (!useRedis) {
        return true;
    }
    try {
        const response = yield redis.ping();
        return response === "PONG";
    }
    catch (_a) {
        return false;
    }
});
exports.pingRedis = pingRedis;
const isRedisRuntimeEnabled = () => useRedis;
exports.isRedisRuntimeEnabled = isRedisRuntimeEnabled;
exports.default = redis;
