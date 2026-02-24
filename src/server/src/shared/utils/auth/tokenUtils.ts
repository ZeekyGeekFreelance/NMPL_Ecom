import jwt from "jsonwebtoken";
import redisClient from "@/infra/cache/redis";

export function generateAccessToken(id: string) {
  const accessSecret = process.env.ACCESS_TOKEN_SECRET;
  if (!accessSecret) {
    throw new Error("ACCESS_TOKEN_SECRET is not configured");
  }

  return jwt.sign({ id }, accessSecret, {
    expiresIn: "15m",
  });
}

export function generateRefreshToken(id: string, absExp?: number) {
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET;
  if (!refreshSecret) {
    throw new Error("REFRESH_TOKEN_SECRET is not configured");
  }

  const absoluteExpiration = absExp || Math.floor(Date.now() / 1000) + 86400;
  const ttl = absoluteExpiration - Math.floor(Date.now() / 1000);

  return jwt.sign({ id, absExp: absoluteExpiration }, refreshSecret, {
    expiresIn: ttl,
  });
}

export const blacklistToken = async (
  token: string,
  ttl: number
): Promise<void> => {
  await redisClient.set(`blacklist:${token}`, "blacklisted", "EX", ttl);
};

export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  try {
    const result = await redisClient.get(`blacklist:${token}`);
    return result !== null;
  } catch (error) {
    // Silently handle Redis errors - token not in Redis is treated as not blacklisted
    return false;
  }
};
