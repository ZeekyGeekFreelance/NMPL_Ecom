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
exports.verifyAndConsumeRegistrationOtp = exports.hasPendingRegistrationOtp = exports.createRegistrationOtp = void 0;
const crypto_1 = __importDefault(require("crypto"));
const redis_1 = __importDefault(require("@/infra/cache/redis"));
const OTP_PREFIX = "registration:otp:";
const OTP_EXPIRY_SECONDS = 10 * 60;
const normalizeEmail = (email) => email.trim().toLowerCase();
const buildRedisKey = (email) => `${OTP_PREFIX}${normalizeEmail(email)}`;
const hashOtp = (email, otpCode) => crypto_1.default
    .createHash("sha256")
    .update(`${normalizeEmail(email)}:${otpCode.trim()}`)
    .digest("hex");
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const createRegistrationOtp = (_a) => __awaiter(void 0, [_a], void 0, function* ({ email, purpose = "USER_PORTAL", requestDealerAccess = false, }) {
    const otpCode = generateOtp();
    const payload = {
        hashedOtp: hashOtp(email, otpCode),
        purpose,
        requestDealerAccess,
    };
    yield redis_1.default.set(buildRedisKey(email), JSON.stringify(payload), "EX", OTP_EXPIRY_SECONDS);
    return { otpCode, expiresInSeconds: OTP_EXPIRY_SECONDS };
});
exports.createRegistrationOtp = createRegistrationOtp;
const hasPendingRegistrationOtp = (email) => __awaiter(void 0, void 0, void 0, function* () {
    const key = buildRedisKey(email);
    const exists = yield redis_1.default.exists(key);
    return exists === 1;
});
exports.hasPendingRegistrationOtp = hasPendingRegistrationOtp;
const verifyAndConsumeRegistrationOtp = (email, otpCode) => __awaiter(void 0, void 0, void 0, function* () {
    const key = buildRedisKey(email);
    const stored = yield redis_1.default.get(key);
    if (!stored)
        return null;
    let payload;
    try {
        payload = JSON.parse(stored);
    }
    catch (_a) {
        yield redis_1.default.del(key);
        return null;
    }
    if (payload.hashedOtp !== hashOtp(email, otpCode)) {
        return null;
    }
    yield redis_1.default.del(key);
    return payload;
});
exports.verifyAndConsumeRegistrationOtp = verifyAndConsumeRegistrationOtp;
