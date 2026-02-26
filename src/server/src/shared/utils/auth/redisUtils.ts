import redisClient from "@/infra/cache/redis";
import logger from "@/infra/winston/logger";

// Blacklist token in Redis
export const blacklistToken = async (
  token: string,
  ttl: number
): Promise<void> => {
  await redisClient.set(`blacklist:${token}`, "blacklisted", "EX", ttl);
};

// Check if token is blacklisted
export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  try {
    const result = await redisClient.get(`blacklist:${token}`);
    return result !== null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`[auth.redisUtils] Redis lookup failed: ${message}`);
    return false;
  }
};
