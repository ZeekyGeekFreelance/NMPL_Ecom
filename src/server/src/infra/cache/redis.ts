import Redis from "ioredis";
import { config } from "@/config";

type CacheRecord = {
  value: string;
  expiresAt: number | null;
};

const nowMs = () => Date.now();

class InMemoryRedisShim {
  private records = new Map<string, CacheRecord>();
  status: string = "ready";

  on(..._args: unknown[]): this {
    return this;
  }

  private getRecord(key: string): CacheRecord | null {
    const record = this.records.get(key);
    if (!record) {
      return null;
    }

    if (record.expiresAt !== null && record.expiresAt <= nowMs()) {
      this.records.delete(key);
      return null;
    }

    return record;
  }

  async connect(): Promise<void> {
    this.status = "ready";
  }

  async ping(): Promise<string> {
    return "PONG";
  }

  async quit(): Promise<void> {
    this.status = "end";
    this.records.clear();
  }

  async get(key: string): Promise<string | null> {
    return this.getRecord(key)?.value ?? null;
  }

  async set(
    key: string,
    value: string,
    ...args: Array<string | number>
  ): Promise<"OK" | null> {
    let ttlSeconds: number | null = null;
    let requireNotExists = false;

    for (let index = 0; index < args.length; index += 1) {
      const token = String(args[index]).toUpperCase();

      if (token === "EX" && index + 1 < args.length) {
        const parsed = Number(args[index + 1]);
        if (Number.isFinite(parsed) && parsed > 0) {
          ttlSeconds = parsed;
        }
        index += 1;
        continue;
      }

      if (token === "NX") {
        requireNotExists = true;
      }
    }

    if (requireNotExists && this.getRecord(key)) {
      return null;
    }

    this.records.set(key, {
      value,
      expiresAt: ttlSeconds === null ? null : nowMs() + ttlSeconds * 1000,
    });
    return "OK";
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<"OK"> {
    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
      throw new Error("[redis-shim] setex requires a positive TTL");
    }

    this.records.set(key, {
      value,
      expiresAt: nowMs() + ttlSeconds * 1000,
    });
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.records.delete(key)) {
        deleted += 1;
      }
    }
    return deleted;
  }

  async ttl(key: string): Promise<number> {
    const record = this.getRecord(key);
    if (!record) {
      return -2;
    }
    if (record.expiresAt === null) {
      return -1;
    }
    const seconds = Math.ceil((record.expiresAt - nowMs()) / 1000);
    return seconds > 0 ? seconds : -2;
  }

  async incr(key: string): Promise<number> {
    const current = this.getRecord(key);
    const parsed = Number(current?.value ?? "0");
    const next = (Number.isFinite(parsed) ? parsed : 0) + 1;
    const expiresAt = current?.expiresAt ?? null;
    this.records.set(key, {
      value: String(next),
      expiresAt,
    });
    return next;
  }

  async expire(key: string, ttlSeconds: number): Promise<number> {
    const current = this.getRecord(key);
    if (!current) {
      return 0;
    }
    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
      throw new Error("[redis-shim] expire requires a positive TTL");
    }
    this.records.set(key, {
      value: current.value,
      expiresAt: nowMs() + ttlSeconds * 1000,
    });
    return 1;
  }

  multi() {
    const keysToDelete: string[] = [];
    const command = {
      del: (key: string) => {
        keysToDelete.push(key);
        return command;
      },
      exec: async () => {
        await this.del(...keysToDelete);
        return [] as any[];
      },
    };
    return command;
  }
}

const useRedis = config.redis.enabled;

if (config.isProduction && !useRedis) {
  throw new Error("[redis] Redis must be enabled in production.");
}

const redis = useRedis
  ? new Redis(config.redis.url as string, {
    lazyConnect: true,
    connectTimeout: config.redis.connectTimeoutMs,
    maxRetriesPerRequest: config.isProduction ? 0 : 1,
    retryStrategy: () => null,
  })
  : new InMemoryRedisShim();

redis.on("connect", () => {
  if (config.isDevelopment && useRedis) {
    console.log("Connected to Redis");
  }
});

redis.on("error", (err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[redis] ${message}`);
});

export const connectRedis = async (): Promise<void> => {
  if (!useRedis) {
    if (config.isDevelopment) {
      console.warn(
        "[redis] REDIS_ENABLED=false in development. Using in-memory cache/session compatibility shim."
      );
    }
    return;
  }

  await redis.connect();
  await redis.ping();
};

export const disconnectRedis = async (): Promise<void> => {
  if (redis.status === "end") {
    return;
  }
  try {
    await redis.quit();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[redis] disconnectRedis: quit failed (${msg}) — continuing shutdown.`);
  }
};

export const pingRedis = async (): Promise<boolean> => {
  if (!useRedis) {
    return true;
  }

  try {
    const response = await redis.ping();
    return response === "PONG";
  } catch {
    return false;
  }
};

export const isRedisRuntimeEnabled = (): boolean => useRedis;

export default redis as any;
