/**
 * catalogCache.ts
 * ──────────────────────────────────────────────────────────────────────────
 * Shared Redis-backed cache invalidation helpers for the product catalog.
 *
 * Previously these functions lived inside `modules/product/graphql/resolver.ts`
 * and were imported FROM there by `product.service.ts`, creating an architectural
 * inversion (a REST service layer importing from a GraphQL resolver).
 *
 * Both `resolver.ts` and `product.service.ts` now import from here.
 */
import redisClient from "@/infra/cache/redis";
import { cacheKey } from "@/shared/utils/cacheKey";

const CATALOG_CACHE_PREFIX = "catalog-listing";
const CATEGORY_CACHE_PREFIX = "catalog-category";

const buildRedisCatalogKey = (rawKey: string): string =>
  cacheKey(CATALOG_CACHE_PREFIX, rawKey);

const buildRedisCategoryKey = (rawKey: string): string =>
  cacheKey(CATEGORY_CACHE_PREFIX, rawKey);

/**
 * Delete all catalog listing cache entries from Redis.
 * Uses SCAN so it is safe on Redis Cluster and does not block with a KEYS call.
 */
export const clearCatalogListingCache = async (): Promise<void> => {
  try {
    const pattern = buildRedisCatalogKey("*");
    if (typeof (redisClient as any).scan === "function") {
      let cursor = "0";
      do {
        const [nextCursor, keys]: [string, string[]] = await (
          redisClient as any
        ).scan(cursor, "MATCH", pattern, "COUNT", 200);
        cursor = nextCursor;
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      } while (cursor !== "0");
    } else {
      // InMemoryRedisShim path (dev without Redis): construct and delete the pattern key directly.
      await redisClient.del(pattern);
    }
  } catch {
    // Non-fatal — worst case stale entries expire naturally via TTL.
  }
};

/**
 * Delete all category cache entries from Redis.
 */
export const clearCategoryCache = async (): Promise<void> => {
  try {
    const pattern = buildRedisCategoryKey("*");
    if (typeof (redisClient as any).scan === "function") {
      let cursor = "0";
      do {
        const [nextCursor, keys]: [string, string[]] = await (
          redisClient as any
        ).scan(cursor, "MATCH", pattern, "COUNT", 200);
        cursor = nextCursor;
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      } while (cursor !== "0");
    } else {
      await redisClient.del(pattern);
    }
  } catch {
    // Non-fatal.
  }
};
