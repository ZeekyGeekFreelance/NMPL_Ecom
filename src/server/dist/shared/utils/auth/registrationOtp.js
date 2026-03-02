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
exports.isRegistrationPhoneOtpEnabled = exports.verifyAndConsumeRegistrationOtp = exports.clearRegistrationOtp = exports.createRegistrationOtp = exports.RegistrationOtpRateLimitError = void 0;
const crypto_1 = __importDefault(require("crypto"));
const redis_1 = __importDefault(require("@/infra/cache/redis"));
const config_1 = require("@/config");
const cacheKey_1 = require("@/shared/utils/cacheKey");
const OTP_EXPIRY_SECONDS = config_1.config.registrationOtp.expirySeconds;
const OTP_RESEND_COOLDOWN_SECONDS = config_1.config.registrationOtp.resendCooldownSeconds;
const OTP_MAX_VERIFY_ATTEMPTS = config_1.config.registrationOtp.maxAttempts;
const REGISTRATION_PHONE_OTP_ENABLED = config_1.config.registrationOtp.phoneOtpEnabled;
class RegistrationOtpRateLimitError extends Error {
    constructor(retryAfterSeconds) {
        super(`OTP recently sent. Please wait ${retryAfterSeconds} seconds before requesting a new one.`);
        this.name = "RegistrationOtpRateLimitError";
        this.retryAfterSeconds = retryAfterSeconds;
    }
}
exports.RegistrationOtpRateLimitError = RegistrationOtpRateLimitError;
const normalizeEmail = (email) => email.trim().toLowerCase();
const normalizePhone = (phone) => phone.trim();
const buildOtpKey = (email) => (0, cacheKey_1.cacheKey)("registration", "otp", normalizeEmail(email));
const buildAttemptKey = (email) => (0, cacheKey_1.cacheKey)("registration", "otp", "attempts", normalizeEmail(email));
const buildCooldownKey = (email) => (0, cacheKey_1.cacheKey)("registration", "otp", "cooldown", normalizeEmail(email));
const hashOtp = (identifier, otpCode, channel) => crypto_1.default
    .createHash("sha256")
    .update(`${identifier}:${channel}:${otpCode.trim()}`)
    .digest("hex");
const generateOtp = () => crypto_1.default.randomInt(0, 1000000).toString().padStart(6, "0");
const safeHashEquals = (firstHash, secondHash) => {
    try {
        const firstBuffer = Buffer.from(firstHash, "hex");
        const secondBuffer = Buffer.from(secondHash, "hex");
        if (firstBuffer.length !== secondBuffer.length) {
            return false;
        }
        return crypto_1.default.timingSafeEqual(firstBuffer, secondBuffer);
    }
    catch (_a) {
        return false;
    }
};
const resolveOtpTtl = (otpKey) => __awaiter(void 0, void 0, void 0, function* () {
    const ttl = yield redis_1.default.ttl(otpKey);
    return ttl > 0 ? ttl : OTP_EXPIRY_SECONDS;
});
const registerFailedAttempt = (email, otpKey) => __awaiter(void 0, void 0, void 0, function* () {
    const attemptKey = buildAttemptKey(email);
    const ttl = yield resolveOtpTtl(otpKey);
    const attempts = yield redis_1.default.incr(attemptKey);
    if (attempts === 1 && ttl > 0) {
        yield redis_1.default.expire(attemptKey, ttl);
    }
    return Math.max(OTP_MAX_VERIFY_ATTEMPTS - attempts, 0);
});
const createRegistrationOtp = (_a) => __awaiter(void 0, [_a], void 0, function* ({ email, phone, purpose = "USER_PORTAL", requestDealerAccess = false, }) {
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);
    const cooldownKey = buildCooldownKey(email);
    const retryAfterSeconds = yield redis_1.default.ttl(cooldownKey);
    if (retryAfterSeconds > 0) {
        throw new RegistrationOtpRateLimitError(retryAfterSeconds);
    }
    const emailOtpCode = generateOtp();
    const phoneOtpCode = REGISTRATION_PHONE_OTP_ENABLED
        ? generateOtp()
        : undefined;
    const payload = {
        hashedEmailOtp: hashOtp(normalizedEmail, emailOtpCode, "EMAIL"),
        hashedPhoneOtp: phoneOtpCode !== undefined
            ? hashOtp(normalizedPhone, phoneOtpCode, "PHONE")
            : null,
        normalizedPhone,
        purpose,
        requestDealerAccess,
    };
    yield redis_1.default
        .multi()
        .set(buildOtpKey(normalizedEmail), JSON.stringify(payload), "EX", OTP_EXPIRY_SECONDS)
        .set(cooldownKey, "1", "EX", OTP_RESEND_COOLDOWN_SECONDS)
        .del(buildAttemptKey(normalizedEmail))
        .exec();
    return {
        emailOtpCode,
        phoneOtpCode,
        expiresInSeconds: OTP_EXPIRY_SECONDS,
        resendAvailableInSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    };
});
exports.createRegistrationOtp = createRegistrationOtp;
const clearRegistrationOtp = (email) => __awaiter(void 0, void 0, void 0, function* () {
    yield redis_1.default.del(buildOtpKey(email), buildAttemptKey(email), buildCooldownKey(email));
});
exports.clearRegistrationOtp = clearRegistrationOtp;
const verifyAndConsumeRegistrationOtp = (email, phone, emailOtpCode, phoneOtpCode) => __awaiter(void 0, void 0, void 0, function* () {
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);
    const otpKey = buildOtpKey(normalizedEmail);
    const stored = yield redis_1.default.get(otpKey);
    if (!stored) {
        return { status: "EXPIRED" };
    }
    let payload;
    try {
        payload = JSON.parse(stored);
    }
    catch (_a) {
        yield (0, exports.clearRegistrationOtp)(normalizedEmail);
        return { status: "EXPIRED" };
    }
    const emailOtpMatches = safeHashEquals(payload.hashedEmailOtp, hashOtp(normalizedEmail, emailOtpCode, "EMAIL"));
    const phoneOtpMatches = !REGISTRATION_PHONE_OTP_ENABLED ||
        (!!payload.hashedPhoneOtp &&
            !!phoneOtpCode &&
            safeHashEquals(payload.hashedPhoneOtp, hashOtp(normalizedPhone, phoneOtpCode, "PHONE")));
    const phoneMatchesRequest = payload.normalizedPhone === normalizedPhone;
    if (!phoneMatchesRequest || !emailOtpMatches || !phoneOtpMatches) {
        const attemptsRemaining = yield registerFailedAttempt(normalizedEmail, otpKey);
        if (attemptsRemaining <= 0) {
            yield (0, exports.clearRegistrationOtp)(normalizedEmail);
            return { status: "LOCKED", attemptsRemaining: 0 };
        }
        return {
            status: "INVALID",
            attemptsRemaining,
        };
    }
    yield redis_1.default.multi().del(otpKey).del(buildAttemptKey(normalizedEmail)).exec();
    return {
        status: "VERIFIED",
        context: {
            purpose: payload.purpose,
            requestDealerAccess: payload.requestDealerAccess,
            normalizedPhone: payload.normalizedPhone,
        },
    };
});
exports.verifyAndConsumeRegistrationOtp = verifyAndConsumeRegistrationOtp;
const isRegistrationPhoneOtpEnabled = () => REGISTRATION_PHONE_OTP_ENABLED;
exports.isRegistrationPhoneOtpEnabled = isRegistrationPhoneOtpEnabled;
