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
exports.verifyAndConsumeRegistrationOtp = exports.clearRegistrationOtp = exports.createRegistrationOtp = exports.RegistrationOtpRateLimitError = void 0;
const crypto_1 = __importDefault(require("crypto"));
const redis_1 = __importDefault(require("@/infra/cache/redis"));
const OTP_KEY_PREFIX = "registration:otp:";
const OTP_ATTEMPT_KEY_PREFIX = "registration:otp:attempts:";
const OTP_COOLDOWN_KEY_PREFIX = "registration:otp:cooldown:";
const toPositiveInteger = (value, fallbackValue) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallbackValue;
};
const OTP_EXPIRY_SECONDS = toPositiveInteger(process.env.REGISTRATION_OTP_EXPIRY_SECONDS, 10 * 60);
const OTP_RESEND_COOLDOWN_SECONDS = toPositiveInteger(process.env.REGISTRATION_OTP_RESEND_COOLDOWN_SECONDS, 60);
const OTP_MAX_VERIFY_ATTEMPTS = toPositiveInteger(process.env.REGISTRATION_OTP_MAX_ATTEMPTS, 5);
class RegistrationOtpRateLimitError extends Error {
    constructor(retryAfterSeconds) {
        super(`OTP recently sent. Please wait ${retryAfterSeconds} seconds before requesting a new one.`);
        this.name = "RegistrationOtpRateLimitError";
        this.retryAfterSeconds = retryAfterSeconds;
    }
}
exports.RegistrationOtpRateLimitError = RegistrationOtpRateLimitError;
const normalizeEmail = (email) => email.trim().toLowerCase();
const buildOtpKey = (email) => `${OTP_KEY_PREFIX}${normalizeEmail(email)}`;
const buildAttemptKey = (email) => `${OTP_ATTEMPT_KEY_PREFIX}${normalizeEmail(email)}`;
const buildCooldownKey = (email) => `${OTP_COOLDOWN_KEY_PREFIX}${normalizeEmail(email)}`;
const hashOtp = (email, otpCode) => crypto_1.default
    .createHash("sha256")
    .update(`${normalizeEmail(email)}:${otpCode.trim()}`)
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
const createRegistrationOtp = (_a) => __awaiter(void 0, [_a], void 0, function* ({ email, purpose = "USER_PORTAL", requestDealerAccess = false, }) {
    const cooldownKey = buildCooldownKey(email);
    const retryAfterSeconds = yield redis_1.default.ttl(cooldownKey);
    if (retryAfterSeconds > 0) {
        throw new RegistrationOtpRateLimitError(retryAfterSeconds);
    }
    const otpCode = generateOtp();
    const payload = {
        hashedOtp: hashOtp(email, otpCode),
        purpose,
        requestDealerAccess,
    };
    yield redis_1.default
        .multi()
        .set(buildOtpKey(email), JSON.stringify(payload), "EX", OTP_EXPIRY_SECONDS)
        .set(cooldownKey, "1", "EX", OTP_RESEND_COOLDOWN_SECONDS)
        .del(buildAttemptKey(email))
        .exec();
    return {
        otpCode,
        expiresInSeconds: OTP_EXPIRY_SECONDS,
        resendAvailableInSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    };
});
exports.createRegistrationOtp = createRegistrationOtp;
const clearRegistrationOtp = (email) => __awaiter(void 0, void 0, void 0, function* () {
    yield redis_1.default.del(buildOtpKey(email), buildAttemptKey(email), buildCooldownKey(email));
});
exports.clearRegistrationOtp = clearRegistrationOtp;
const verifyAndConsumeRegistrationOtp = (email, otpCode) => __awaiter(void 0, void 0, void 0, function* () {
    const otpKey = buildOtpKey(email);
    const stored = yield redis_1.default.get(otpKey);
    if (!stored) {
        return { status: "EXPIRED" };
    }
    let payload;
    try {
        payload = JSON.parse(stored);
    }
    catch (_a) {
        yield (0, exports.clearRegistrationOtp)(email);
        return { status: "EXPIRED" };
    }
    const inputHash = hashOtp(email, otpCode);
    if (!safeHashEquals(payload.hashedOtp, inputHash)) {
        const attemptsRemaining = yield registerFailedAttempt(email, otpKey);
        if (attemptsRemaining <= 0) {
            yield (0, exports.clearRegistrationOtp)(email);
            return { status: "LOCKED", attemptsRemaining: 0 };
        }
        return {
            status: "INVALID",
            attemptsRemaining,
        };
    }
    yield redis_1.default.multi().del(otpKey).del(buildAttemptKey(email)).exec();
    return {
        status: "VERIFIED",
        context: payload,
    };
});
exports.verifyAndConsumeRegistrationOtp = verifyAndConsumeRegistrationOtp;
