import redisClient from "@/infra/cache/redis";
import crypto from "crypto";
import { assertFiniteTtl, cacheKey } from "@/shared/utils/cacheKey";

// Blacklist token in Redis
export const blacklistToken = async (
  token: string,
  ttl: number
): Promise<void> => {
  assertFiniteTtl(ttl, "token-blacklist");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  await redisClient.set(
    cacheKey("auth", "blacklist", tokenHash),
    "blacklisted",
    "EX",
    ttl
  );
};

// Check if token is blacklisted
export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const result = await redisClient.get(cacheKey("auth", "blacklist", tokenHash));
  return result !== null;
};
