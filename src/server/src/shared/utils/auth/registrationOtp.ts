import crypto from "crypto";
import redisClient from "@/infra/cache/redis";
import type { RegistrationPurpose } from "@/modules/auth/auth.types";
import { config } from "@/config";
import { cacheKey } from "@/shared/utils/cacheKey";

const OTP_EXPIRY_SECONDS = config.registrationOtp.expirySeconds;
const OTP_RESEND_COOLDOWN_SECONDS = config.registrationOtp.resendCooldownSeconds;
const OTP_MAX_VERIFY_ATTEMPTS = config.registrationOtp.maxAttempts;
const REGISTRATION_PHONE_OTP_ENABLED = config.registrationOtp.phoneOtpEnabled;

export interface StoredRegistrationOtp {
  hashedEmailOtp: string;
  hashedPhoneOtp?: string | null;
  normalizedPhone: string;
  purpose: RegistrationPurpose;
  requestDealerAccess: boolean;
}

interface CreateRegistrationOtpInput {
  email: string;
  phone: string;
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
  | {
      status: "VERIFIED";
      context: Pick<
        StoredRegistrationOtp,
        "purpose" | "requestDealerAccess" | "normalizedPhone"
      >;
    }
  | { status: "INVALID"; attemptsRemaining: number }
  | { status: "LOCKED"; attemptsRemaining: 0 }
  | { status: "EXPIRED" };

const normalizeEmail = (email: string): string => email.trim().toLowerCase();
const normalizePhone = (phone: string): string => phone.trim();

const buildOtpKey = (email: string): string =>
  cacheKey("registration", "otp", normalizeEmail(email));

const buildAttemptKey = (email: string): string =>
  cacheKey("registration", "otp", "attempts", normalizeEmail(email));

const buildCooldownKey = (email: string): string =>
  cacheKey("registration", "otp", "cooldown", normalizeEmail(email));

const hashOtp = (
  identifier: string,
  otpCode: string,
  channel: "EMAIL" | "PHONE"
): string =>
  crypto
    .createHash("sha256")
    .update(`${identifier}:${channel}:${otpCode.trim()}`)
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
  phone,
  purpose = "USER_PORTAL",
  requestDealerAccess = false,
}: CreateRegistrationOtpInput): Promise<{
  emailOtpCode: string;
  phoneOtpCode?: string;
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
}> => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);
  const cooldownKey = buildCooldownKey(email);
  const retryAfterSeconds = await redisClient.ttl(cooldownKey);

  if (retryAfterSeconds > 0) {
    throw new RegistrationOtpRateLimitError(retryAfterSeconds);
  }

  const emailOtpCode = generateOtp();
  const phoneOtpCode = REGISTRATION_PHONE_OTP_ENABLED
    ? generateOtp()
    : undefined;
  const payload: StoredRegistrationOtp = {
    hashedEmailOtp: hashOtp(normalizedEmail, emailOtpCode, "EMAIL"),
    hashedPhoneOtp:
      phoneOtpCode !== undefined
        ? hashOtp(normalizedPhone, phoneOtpCode, "PHONE")
        : null,
    normalizedPhone,
    purpose,
    requestDealerAccess,
  };

  await redisClient
    .multi()
    .set(
      buildOtpKey(normalizedEmail),
      JSON.stringify(payload),
      "EX",
      OTP_EXPIRY_SECONDS
    )
    .set(cooldownKey, "1", "EX", OTP_RESEND_COOLDOWN_SECONDS)
    .del(buildAttemptKey(normalizedEmail))
    .exec();

  return {
    emailOtpCode,
    phoneOtpCode,
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
  phone: string,
  emailOtpCode: string,
  phoneOtpCode?: string
): Promise<VerifyRegistrationOtpResult> => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);
  const otpKey = buildOtpKey(normalizedEmail);
  const stored = await redisClient.get(otpKey);
  if (!stored) {
    return { status: "EXPIRED" };
  }

  let payload: StoredRegistrationOtp;
  try {
    payload = JSON.parse(stored) as StoredRegistrationOtp;
  } catch {
    await clearRegistrationOtp(normalizedEmail);
    return { status: "EXPIRED" };
  }

  const emailOtpMatches = safeHashEquals(
    payload.hashedEmailOtp,
    hashOtp(normalizedEmail, emailOtpCode, "EMAIL")
  );
  const phoneOtpMatches = !REGISTRATION_PHONE_OTP_ENABLED ||
    (!!payload.hashedPhoneOtp &&
      !!phoneOtpCode &&
      safeHashEquals(
        payload.hashedPhoneOtp,
        hashOtp(normalizedPhone, phoneOtpCode, "PHONE")
      ));
  const phoneMatchesRequest = payload.normalizedPhone === normalizedPhone;

  if (!phoneMatchesRequest || !emailOtpMatches || !phoneOtpMatches) {
    const attemptsRemaining = await registerFailedAttempt(normalizedEmail, otpKey);

    if (attemptsRemaining <= 0) {
      await clearRegistrationOtp(normalizedEmail);
      return { status: "LOCKED", attemptsRemaining: 0 };
    }

    return {
      status: "INVALID",
      attemptsRemaining,
    };
  }

  await redisClient.multi().del(otpKey).del(buildAttemptKey(normalizedEmail)).exec();
  return {
    status: "VERIFIED",
    context: {
      purpose: payload.purpose,
      requestDealerAccess: payload.requestDealerAccess,
      normalizedPhone: payload.normalizedPhone,
    },
  };
};

export const isRegistrationPhoneOtpEnabled = (): boolean =>
  REGISTRATION_PHONE_OTP_ENABLED;
