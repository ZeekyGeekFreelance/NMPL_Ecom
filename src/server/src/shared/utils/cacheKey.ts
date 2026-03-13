import crypto from "crypto";
import { config } from "@/config";

const CACHE_SEGMENT_PATTERN = /^[a-zA-Z0-9:_-]+$/;

const normalizeSegment = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("[cache] Cache key segment cannot be empty");
  }

  if (CACHE_SEGMENT_PATTERN.test(trimmed)) {
    return trimmed;
  }

  return crypto.createHash("sha256").update(trimmed).digest("hex");
};

export const cacheKey = (...segments: string[]): string => {
  const normalizedSegments = segments.map(normalizeSegment);
  return [config.redis.namespace, ...normalizedSegments].join(":");
};

export const assertFiniteTtl = (ttl: number, keyLabel: string): void => {
  if (!Number.isFinite(ttl) || ttl <= 0) {
    throw new Error(
      `[cache] Invalid TTL for ${keyLabel}. TTL must be a positive finite number.`
    );
  }
};
