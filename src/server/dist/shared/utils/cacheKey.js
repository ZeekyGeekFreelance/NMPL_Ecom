"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertFiniteTtl = exports.cacheKey = void 0;
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("@/config");
const CACHE_SEGMENT_PATTERN = /^[a-zA-Z0-9:_-]+$/;
const normalizeSegment = (value) => {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error("[cache] Cache key segment cannot be empty");
    }
    if (CACHE_SEGMENT_PATTERN.test(trimmed)) {
        return trimmed;
    }
    return crypto_1.default.createHash("sha256").update(trimmed).digest("hex");
};
const cacheKey = (...segments) => {
    const normalizedSegments = segments.map(normalizeSegment);
    return [config_1.config.redis.namespace, ...normalizedSegments].join(":");
};
exports.cacheKey = cacheKey;
const assertFiniteTtl = (ttl, keyLabel) => {
    if (!Number.isFinite(ttl) || ttl <= 0) {
        throw new Error(`[cache] Invalid TTL for ${keyLabel}. TTL must be a positive finite number.`);
    }
};
exports.assertFiniteTtl = assertFiniteTtl;
