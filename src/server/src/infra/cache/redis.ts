import Redis from "ioredis";

const parsedPort = Number(process.env.REDIS_PORT ?? "6379");
const fallbackPort = Number.isFinite(parsedPort) ? parsedPort : 6379;
const redisUrl = process.env.REDIS_URL?.trim();
const redisHost = process.env.REDIS_HOST?.trim();

const redis = redisHost
  ? new Redis({
      host: redisHost,
      port: fallbackPort,
    })
  : redisUrl
    ? new Redis(redisUrl)
    : new Redis({
        host: "127.0.0.1",
        port: fallbackPort,
      });

redis
  .on("connect", () => console.log("Connected to Redis"))
  .on("error", (err) => console.error("Redis error:", err));

export default redis;
