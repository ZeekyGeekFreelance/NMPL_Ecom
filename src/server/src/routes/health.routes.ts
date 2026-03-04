import { Router } from "express";
import { pingDB } from "../infra/database/database.config";
import { pingRedis } from "../infra/cache/redis";
import { config } from "@/config";
import { bootState } from "@/bootstrap/state";

const router = Router();

const buildHealthPayload = async () => {
  // Allow up to 10s for DB ping — Neon free tier has cold-start latency.
  const dbConnected = await Promise.race([
    pingDB(),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10_000)),
  ]);
  const redisConnected = config.redis.enabled ? await pingRedis() : true;
  const heapUsedMb = Math.round(process.memoryUsage().heapUsed / (1024 * 1024));
  const memoryHealthy = heapUsedMb <= config.server.memoryUnhealthyThresholdMb;

  const healthy =
    dbConnected &&
    redisConnected &&
    bootState.configValidated &&
    bootState.migrationsApplied &&
    memoryHealthy;

  return {
    healthy,
    status: healthy ? "healthy" : "unhealthy",
    environment: config.nodeEnv,
    checks: {
      database: dbConnected,
      redis: redisConnected,
      config: bootState.configValidated,
      migration: bootState.migrationsApplied,
      memory: memoryHealthy,
    },
    memory: {
      heapUsedMb,
      thresholdMb: config.server.memoryUnhealthyThresholdMb,
    },
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
};

router.get("/health", async (_req, res) => {
  const payload = await buildHealthPayload();
  res.status(payload.healthy ? 200 : 503).json(payload);
});

router.get("/ready", async (_req, res) => {
  const payload = await buildHealthPayload();
  res.status(payload.healthy ? 200 : 503).json(payload);
});

router.get("/live", (_req, res) => {
  res.status(200).json({
    status: "alive",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

export default router;
