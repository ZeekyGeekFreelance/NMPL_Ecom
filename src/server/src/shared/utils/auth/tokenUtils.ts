import jwt from "jsonwebtoken";
import redisClient from "@/infra/cache/redis";
import crypto from "crypto";
import { config } from "@/config";
import { assertFiniteTtl, cacheKey } from "@/shared/utils/cacheKey";

export function generateAccessToken(id: string) {
  return jwt.sign({ id }, config.auth.accessTokenSecret, {
    expiresIn: config.auth.accessTtlSeconds,
  });
}

export function generateRefreshToken(id: string, absExp?: number) {
  const absoluteExpiration =
    absExp ||
    Math.floor(Date.now() / 1000) + config.auth.refreshAbsoluteTtlSeconds;
  const ttl = absoluteExpiration - Math.floor(Date.now() / 1000);
  assertFiniteTtl(ttl, "refresh-token");

  return jwt.sign({ id, absExp: absoluteExpiration }, config.auth.refreshTokenSecret, {
    expiresIn: ttl,
  });
}

const tokenHash = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

export const blacklistToken = async (
  token: string,
  ttl: number
): Promise<void> => {
  assertFiniteTtl(ttl, "token-blacklist");
  await redisClient.set(
    cacheKey("auth", "blacklist", tokenHash(token)),
    "blacklisted",
    "EX",
    ttl
  );
};

export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  const result = await redisClient.get(
    cacheKey("auth", "blacklist", tokenHash(token))
  );
  return result !== null;
};
