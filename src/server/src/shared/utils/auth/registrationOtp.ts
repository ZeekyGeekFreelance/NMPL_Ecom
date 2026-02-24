import crypto from "crypto";
import redisClient from "@/infra/cache/redis";
import type { RegistrationPurpose } from "@/modules/auth/auth.types";

const OTP_PREFIX = "registration:otp:";
const OTP_EXPIRY_SECONDS = 10 * 60;

interface StoredRegistrationOtp {
  hashedOtp: string;
  purpose: RegistrationPurpose;
  requestDealerAccess: boolean;
}

interface CreateRegistrationOtpInput {
  email: string;
  purpose?: RegistrationPurpose;
  requestDealerAccess?: boolean;
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const buildRedisKey = (email: string): string =>
  `${OTP_PREFIX}${normalizeEmail(email)}`;

const hashOtp = (email: string, otpCode: string): string =>
  crypto
    .createHash("sha256")
    .update(`${normalizeEmail(email)}:${otpCode.trim()}`)
    .digest("hex");

const generateOtp = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const createRegistrationOtp = async ({
  email,
  purpose = "USER_PORTAL",
  requestDealerAccess = false,
}: CreateRegistrationOtpInput): Promise<{ otpCode: string; expiresInSeconds: number }> => {
  const otpCode = generateOtp();
  const payload: StoredRegistrationOtp = {
    hashedOtp: hashOtp(email, otpCode),
    purpose,
    requestDealerAccess,
  };

  await redisClient.set(
    buildRedisKey(email),
    JSON.stringify(payload),
    "EX",
    OTP_EXPIRY_SECONDS
  );

  return { otpCode, expiresInSeconds: OTP_EXPIRY_SECONDS };
};

export const hasPendingRegistrationOtp = async (
  email: string
): Promise<boolean> => {
  const key = buildRedisKey(email);
  const exists = await redisClient.exists(key);
  return exists === 1;
};

export const verifyAndConsumeRegistrationOtp = async (
  email: string,
  otpCode: string
): Promise<StoredRegistrationOtp | null> => {
  const key = buildRedisKey(email);
  const stored = await redisClient.get(key);
  if (!stored) return null;

  let payload: StoredRegistrationOtp;
  try {
    payload = JSON.parse(stored) as StoredRegistrationOtp;
  } catch {
    await redisClient.del(key);
    return null;
  }

  if (payload.hashedOtp !== hashOtp(email, otpCode)) {
    return null;
  }

  await redisClient.del(key);
  return payload;
};
