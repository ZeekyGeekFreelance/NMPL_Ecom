import { Router } from "express";
import { pingDB } from "../infra/database/database.config";
import { pingRedis } from "../infra/cache/redis";
import { config } from "@/config";
import { bootState } from "@/bootstrap/state";
import { isAllowedOrigin } from "@/config";

const router = Router();

// Add CORS headers to health endpoints so they can be called from the browser
const addHealthCorsHeaders = (req: any, res: any) => {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
};

const buildHealthPayload = async () => {
  // Allow up to 10s for DB ping — Neon free tier has cold-start latency.
  const dbConnected = await Promise.race([
    pingDB().catch(() => false),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3_000)),
  ]);
  const redisConnected = config.redis.enabled ? await pingRedis().catch(() => false) : true;
  const heapUsedMb = Math.round(process.memoryUsage().heapUsed / (1024 * 1024));
  const memoryHealthy = heapUsedMb <= config.server.memoryUnhealthyThresholdMb;

  const healthy =
    dbConnected &&
    redisConnected &&
    bootState.configValidated &&
    bootState.migrationsApplied &&
    bootState.serverReady &&
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
      serverReady: bootState.serverReady,
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

router.get("/health", (req, res, next) => { res.setHeader("Access-Control-Allow-Origin", "*"); next(); }, async (req, res) => {
  addHealthCorsHeaders(req, res);
  try {
    const payload = await buildHealthPayload();
    res.status(payload.healthy ? 200 : 503).json(payload);
  } catch (error) {
    // Fallback health response if main health check fails
    res.status(503).json({
      healthy: false,
      status: "error",
      message: "Health check failed",
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  }
});

router.get("/ready", (req, res, next) => { res.setHeader("Access-Control-Allow-Origin", "*"); next(); }, async (req, res) => {
  addHealthCorsHeaders(req, res);
  try {
    const payload = await buildHealthPayload();
    res.status(payload.healthy ? 200 : 503).json(payload);
  } catch (error) {
    res.status(503).json({
      healthy: false,
      status: "error",
      message: "Readiness check failed",
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
});

router.get("/live", (req, res, next) => { res.setHeader("Access-Control-Allow-Origin", "*"); next(); }, (req, res) => {
  addHealthCorsHeaders(req, res);
  res.status(200).json({
    status: "alive",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

export default router;
