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
exports.generateAccessToken = generateAccessToken;
exports.generateRefreshToken = generateRefreshToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const redis_1 = __importDefault(require("@/infra/cache/redis"));
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("@/config");
const cacheKey_1 = require("@/shared/utils/cacheKey");
function generateAccessToken(id) {
    return jsonwebtoken_1.default.sign({ id }, config_1.config.auth.accessTokenSecret, {
        expiresIn: config_1.config.auth.accessTtlSeconds,
    });
}
function generateRefreshToken(id, absExp) {
    const absoluteExpiration = absExp ||
        Math.floor(Date.now() / 1000) + config_1.config.auth.refreshAbsoluteTtlSeconds;
    const ttl = absoluteExpiration - Math.floor(Date.now() / 1000);
    (0, cacheKey_1.assertFiniteTtl)(ttl, "refresh-token");
    return jsonwebtoken_1.default.sign({ id, absExp: absoluteExpiration }, config_1.config.auth.refreshTokenSecret, {
        expiresIn: ttl,
    });
}
const tokenHash = (token) => crypto_1.default.createHash("sha256").update(token).digest("hex");
const blacklistToken = (token, ttl) => __awaiter(void 0, void 0, void 0, function* () {
    (0, cacheKey_1.assertFiniteTtl)(ttl, "token-blacklist");
    yield redis_1.default.set((0, cacheKey_1.cacheKey)("auth", "blacklist", tokenHash(token)), "blacklisted", "EX", ttl);
});
exports.blacklistToken = blacklistToken;
const isTokenBlacklisted = (token) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield redis_1.default.get((0, cacheKey_1.cacheKey)("auth", "blacklist", tokenHash(token)));
    return result !== null;
});
exports.isTokenBlacklisted = isTokenBlacklisted;
