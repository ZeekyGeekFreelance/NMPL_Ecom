"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
const ioredis_1 = __importDefault(require("ioredis"));
const isDevelopment = process.env.NODE_ENV !== "production";
const parsedPort = Number((_a = process.env.REDIS_PORT) !== null && _a !== void 0 ? _a : "6379");
const fallbackPort = Number.isFinite(parsedPort) ? parsedPort : 6379;
const redisUrl = (_b = process.env.REDIS_URL) === null || _b === void 0 ? void 0 : _b.trim();
const redisHost = (_c = process.env.REDIS_HOST) === null || _c === void 0 ? void 0 : _c.trim();
const redis = redisHost
    ? new ioredis_1.default({
        host: redisHost,
        port: fallbackPort,
    })
    : redisUrl
        ? new ioredis_1.default(redisUrl)
        : new ioredis_1.default({
            host: "127.0.0.1",
            port: fallbackPort,
        });
redis
    .on("connect", () => {
    if (isDevelopment) {
        console.log("Connected to Redis");
    }
})
    .on("error", (err) => console.error("Redis error:", err));
exports.default = redis;
