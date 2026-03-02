"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_config_1 = require("../infra/database/database.config");
const redis_1 = require("../infra/cache/redis");
const config_1 = require("@/config");
const state_1 = require("@/bootstrap/state");
const router = (0, express_1.Router)();
const buildHealthPayload = () => __awaiter(void 0, void 0, void 0, function* () {
    const dbConnected = yield (0, database_config_1.pingDB)();
    const redisConnected = config_1.config.redis.enabled ? yield (0, redis_1.pingRedis)() : true;
    const heapUsedMb = Math.round(process.memoryUsage().heapUsed / (1024 * 1024));
    const memoryHealthy = heapUsedMb <= config_1.config.server.memoryUnhealthyThresholdMb;
    const healthy = dbConnected &&
        redisConnected &&
        state_1.bootState.configValidated &&
        state_1.bootState.migrationsApplied &&
        memoryHealthy;
    return {
        healthy,
        status: healthy ? "healthy" : "unhealthy",
        environment: config_1.config.nodeEnv,
        checks: {
            database: dbConnected,
            redis: redisConnected,
            config: state_1.bootState.configValidated,
            migration: state_1.bootState.migrationsApplied,
            memory: memoryHealthy,
        },
        memory: {
            heapUsedMb,
            thresholdMb: config_1.config.server.memoryUnhealthyThresholdMb,
        },
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
    };
});
router.get("/health", (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const payload = yield buildHealthPayload();
    res.status(payload.healthy ? 200 : 503).json(payload);
}));
router.get("/ready", (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const payload = yield buildHealthPayload();
    res.status(payload.healthy ? 200 : 503).json(payload);
}));
router.get("/live", (_req, res) => {
    res.status(200).json({
        status: "alive",
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
    });
});
exports.default = router;
