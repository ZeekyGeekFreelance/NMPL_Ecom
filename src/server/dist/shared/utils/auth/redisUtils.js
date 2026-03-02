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
exports.isTokenBlacklisted = exports.blacklistToken = void 0;
const redis_1 = __importDefault(require("@/infra/cache/redis"));
const crypto_1 = __importDefault(require("crypto"));
const cacheKey_1 = require("@/shared/utils/cacheKey");
// Blacklist token in Redis
const blacklistToken = (token, ttl) => __awaiter(void 0, void 0, void 0, function* () {
    (0, cacheKey_1.assertFiniteTtl)(ttl, "token-blacklist");
    const tokenHash = crypto_1.default.createHash("sha256").update(token).digest("hex");
    yield redis_1.default.set((0, cacheKey_1.cacheKey)("auth", "blacklist", tokenHash), "blacklisted", "EX", ttl);
});
exports.blacklistToken = blacklistToken;
// Check if token is blacklisted
const isTokenBlacklisted = (token) => __awaiter(void 0, void 0, void 0, function* () {
    const tokenHash = crypto_1.default.createHash("sha256").update(token).digest("hex");
    const result = yield redis_1.default.get((0, cacheKey_1.cacheKey)("auth", "blacklist", tokenHash));
    return result !== null;
});
exports.isTokenBlacklisted = isTokenBlacklisted;
