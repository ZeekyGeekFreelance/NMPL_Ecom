import crypto from "crypto";
import redisClient from "@/infra/cache/redis";
import type { RegistrationPurpose } from "@/modules/auth/auth.types";

const OTP_KEY_PREFIX = "registration:otp:";
const OTP_ATTEMPT_KEY_PREFIX = "registration:otp:attempts:";
const OTP_COOLDOWN_KEY_PREFIX = "registration:otp:cooldown:";

const toPositiveInteger = (
  value: string | undefined,
  fallbackValue: number
): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallbackValue;
};

const OTP_EXPIRY_SECONDS = toPositiveInteger(
  process.env.REGISTRATION_OTP_EXPIRY_SECONDS,
  10 * 60
);
const OTP_RESEND_COOLDOWN_SECONDS = toPositiveInteger(
  process.env.REGISTRATION_OTP_RESEND_COOLDOWN_SECONDS,
  60
);
const OTP_MAX_VERIFY_ATTEMPTS = toPositiveInteger(
  process.env.REGISTRATION_OTP_MAX_ATTEMPTS,
  5
);

export interface StoredRegistrationOtp {
  hashedOtp: string;
  purpose: RegistrationPurpose;
  requestDealerAccess: boolean;
}

interface CreateRegistrationOtpInput {
  email: string;
  purpose?: RegistrationPurpose;
  requestDealerAccess?: boolean;
}

export class RegistrationOtpRateLimitError extends Error {
  public retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(
      `OTP recently sent. Please wait ${retryAfterSeconds} seconds before requesting a new one.`
    );
    this.name = "RegistrationOtpRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export type VerifyRegistrationOtpResult =
  | { status: "VERIFIED"; context: StoredRegistrationOtp }
  | { status: "INVALID"; attemptsRemaining: number }
  | { status: "LOCKED"; attemptsRemaining: 0 }
  | { status: "EXPIRED" };

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const buildOtpKey = (email: string): string =>
  `${OTP_KEY_PREFIX}${normalizeEmail(email)}`;

const buildAttemptKey = (email: string): string =>
  `${OTP_ATTEMPT_KEY_PREFIX}${normalizeEmail(email)}`;

const buildCooldownKey = (email: string): string =>
  `${OTP_COOLDOWN_KEY_PREFIX}${normalizeEmail(email)}`;

const hashOtp = (email: string, otpCode: string): string =>
  crypto
    .createHash("sha256")
    .update(`${normalizeEmail(email)}:${otpCode.trim()}`)
    .digest("hex");

const generateOtp = (): string =>
  crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");

const safeHashEquals = (firstHash: string, secondHash: string): boolean => {
  try {
    const firstBuffer = Buffer.from(firstHash, "hex");
    const secondBuffer = Buffer.from(secondHash, "hex");
    if (firstBuffer.length !== secondBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(firstBuffer, secondBuffer);
  } catch {
    return false;
  }
};

const resolveOtpTtl = async (otpKey: string): Promise<number> => {
  const ttl = await redisClient.ttl(otpKey);
  return ttl > 0 ? ttl : OTP_EXPIRY_SECONDS;
};

const registerFailedAttempt = async (
  email: string,
  otpKey: string
): Promise<number> => {
  const attemptKey = buildAttemptKey(email);
  const ttl = await resolveOtpTtl(otpKey);
  const attempts = await redisClient.incr(attemptKey);

  if (attempts === 1 && ttl > 0) {
    await redisClient.expire(attemptKey, ttl);
  }

  return Math.max(OTP_MAX_VERIFY_ATTEMPTS - attempts, 0);
};

export const createRegistrationOtp = async ({
  email,
  purpose = "USER_PORTAL",
  requestDealerAccess = false,
}: CreateRegistrationOtpInput): Promise<{
  otpCode: string;
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
}> => {
  const cooldownKey = buildCooldownKey(email);
  const retryAfterSeconds = await redisClient.ttl(cooldownKey);

  if (retryAfterSeconds > 0) {
    throw new RegistrationOtpRateLimitError(retryAfterSeconds);
  }

  const otpCode = generateOtp();
  const payload: StoredRegistrationOtp = {
    hashedOtp: hashOtp(email, otpCode),
    purpose,
    requestDealerAccess,
  };

  await redisClient
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
};

export const clearRegistrationOtp = async (email: string): Promise<void> => {
  await redisClient.del(
    buildOtpKey(email),
    buildAttemptKey(email),
    buildCooldownKey(email)
  );
};

export const verifyAndConsumeRegistrationOtp = async (
  email: string,
  otpCode: string
): Promise<VerifyRegistrationOtpResult> => {
  const otpKey = buildOtpKey(email);
  const stored = await redisClient.get(otpKey);
  if (!stored) {
    return { status: "EXPIRED" };
  }

  let payload: StoredRegistrationOtp;
  try {
    payload = JSON.parse(stored) as StoredRegistrationOtp;
  } catch {
    await clearRegistrationOtp(email);
    return { status: "EXPIRED" };
  }

  const inputHash = hashOtp(email, otpCode);
  if (!safeHashEquals(payload.hashedOtp, inputHash)) {
    const attemptsRemaining = await registerFailedAttempt(email, otpKey);

    if (attemptsRemaining <= 0) {
      await clearRegistrationOtp(email);
      return { status: "LOCKED", attemptsRemaining: 0 };
    }

    return {
      status: "INVALID",
      attemptsRemaining,
    };
  }

  await redisClient.multi().del(otpKey).del(buildAttemptKey(email)).exec();
  return {
    status: "VERIFIED",
    context: payload,
  };
};
