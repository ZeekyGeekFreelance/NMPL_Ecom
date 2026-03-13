/**
 * protectCache.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Redis-backed cache for the protect middleware user lookup.
 *
 * Problem solved: protect.ts previously issued a DB query on EVERY authenticated
 * request to fetch role + tokenVersion + dealerProfile.status.  Under load this
 * adds significant latency and DB connection pressure.
 *
 * Strategy:
 *  - Cache the minimal user record needed by protect.ts (role, tokenVersion,
 *    dealerProfile.status) in Redis under `protect:user:{userId}` with a 60-second TTL.
 *  - Explicitly invalidate (DEL) the cache key wherever tokenVersion is incremented:
 *      • auth.repository.ts → updateUserPassword (invalidateSessions: true)
 *      • user.repository.ts → updateUserPassword, incrementUserTokenVersion
 *      • shared/repositories/dealer.repository.ts → updateDealerStatus (CTE increments tokenVersion)
 *
 * Why this is safe:
 *  - tokenVersion is still verified on every request — a stale cache entry
 *    that survived before explicit invalidation would have the OLD tokenVersion,
 *    causing the JWT tokenVersion check to fail and reject the request correctly.
 *  - 60-second TTL is a hard backstop for any edge case that bypasses explicit invalidation.
 */

import redisClient from "@/infra/cache/redis";

const PROTECT_USER_CACHE_TTL_SECONDS = 60;
const CACHE_KEY_PREFIX = "protect:user";

export interface ProtectUserCacheRecord {
  id: string;
  role: string;
  tokenVersion: number;
  dealerProfile: { status: string } | null;
}

const buildKey = (userId: string): string => `${CACHE_KEY_PREFIX}:${userId}`;

/**
 * Read a user record from the protect cache.
 * Returns null on miss, parse error, or Redis unavailability.
 */
export const getProtectUserCache = async (
  userId: string
): Promise<ProtectUserCacheRecord | null> => {
  try {
    const json = await redisClient.get(buildKey(userId));
    if (!json) return null;
    return JSON.parse(json) as ProtectUserCacheRecord;
  } catch {
    // Redis unavailable or corrupt entry — treat as a cache miss.
    return null;
  }
};

/**
 * Write a user record into the protect cache with a 60-second TTL.
 * Best-effort: a write failure is silently ignored.
 */
export const setProtectUserCache = async (
  userId: string,
  record: ProtectUserCacheRecord
): Promise<void> => {
  try {
    await redisClient.setex(
      buildKey(userId),
      PROTECT_USER_CACHE_TTL_SECONDS,
      JSON.stringify(record)
    );
  } catch {
    // Best-effort — the middleware still works without the cache.
  }
};

/**
 * Invalidate the protect cache for a user.
 * Must be called wherever tokenVersion is incremented (password change,
 * dealer status update) so stale records cannot authorise revoked sessions.
 */
export const clearProtectUserCache = async (userId: string): Promise<void> => {
  try {
    await redisClient.del(buildKey(userId));
  } catch {
    // Best-effort.
  }
};
