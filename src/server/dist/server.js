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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
require("reflect-metadata");
const module_alias_1 = require("module-alias");
const path_1 = __importDefault(require("path"));
const runtimeRoot = path_1.default.resolve(__dirname);
(0, module_alias_1.addAlias)("@", runtimeRoot);
const { createApp } = require("./app");
const { config } = require("./config");
const { disconnectDB } = require("./infra/database/database.config");
const { disconnectRedis } = require("./infra/cache/redis");
const { assertApiPortParity, assertClusterParity, assertMigrationsApplied, assertMixedModeMismatch, assertPortAvailable, assertResourceGuards, printStartupDiagnostics, } = require("./bootstrap/preflight");
const { bootState } = require("./bootstrap/state");
let shuttingDown = false;
const gracefulShutdown = (reason, httpServer) => __awaiter(void 0, void 0, void 0, function* () {
    if (shuttingDown) {
        return;
    }
    shuttingDown = true;
    console.log(`[shutdown] Signal received: ${reason}`);
    try {
        yield Promise.allSettled([
            new Promise((resolve) => {
                if (!httpServer) {
                    resolve();
                    return;
                }
                httpServer.close(() => resolve());
            }),
            disconnectDB(),
            disconnectRedis(),
        ]);
        process.exit(0);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[shutdown] Failed clean shutdown: ${message}`);
        process.exit(1);
    }
});
function bootstrap() {
    return __awaiter(this, void 0, void 0, function* () {
        bootState.configValidated = true;
        assertApiPortParity();
        yield assertPortAvailable();
        assertResourceGuards();
        yield assertMixedModeMismatch();
        assertMigrationsApplied();
        bootState.migrationsApplied = true;
        const { httpServer } = yield createApp();
        yield assertClusterParity();
        printStartupDiagnostics();
        httpServer.on("error", (err) => {
            const nodeError = err;
            if (nodeError.code === "EADDRINUSE") {
                console.error(`[boot] Port ${config.server.port} is already in use. Update PORT and client API env consistently.`);
            }
            else {
                console.error("[boot] Server error:", err);
            }
            process.exit(1);
        });
        process.on("SIGTERM", () => {
            void gracefulShutdown("SIGTERM", httpServer);
        });
        process.on("SIGINT", () => {
            void gracefulShutdown("SIGINT", httpServer);
        });
        process.on("uncaughtException", (error) => {
            console.error("[boot] uncaughtException", error);
            void gracefulShutdown("uncaughtException", httpServer);
        });
        process.on("unhandledRejection", (reason) => {
            console.error("[boot] unhandledRejection", reason);
            void gracefulShutdown("unhandledRejection", httpServer);
        });
        httpServer.listen(config.server.port, () => {
            console.log(`[boot] Server is running on port ${config.server.port}`);
        });
    });
}
bootstrap().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to bootstrap server: ${errorMessage}`);
    process.exit(1);
});
