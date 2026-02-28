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
exports.startQuotationExpiryWorker = void 0;
const logs_factory_1 = require("../logs/logs.factory");
const transaction_repository_1 = require("./transaction.repository");
const transaction_service_1 = require("./transaction.service");
const orderLifecycle_1 = require("@/shared/utils/orderLifecycle");
let workerInitialized = false;
const startQuotationExpiryWorker = () => {
    if (workerInitialized) {
        return;
    }
    workerInitialized = true;
    const logsService = (0, logs_factory_1.makeLogsService)();
    const service = new transaction_service_1.TransactionService(new transaction_repository_1.TransactionRepository());
    const intervalMs = (0, orderLifecycle_1.getReservationSweepSeconds)() * 1000;
    let isRunning = false;
    const runSweep = () => __awaiter(void 0, void 0, void 0, function* () {
        if (isRunning) {
            return;
        }
        isRunning = true;
        try {
            const expiredCount = yield service.processExpiredQuotations();
            if (expiredCount > 0) {
                yield logsService.info("Expired quotations processed", {
                    expiredCount,
                });
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : "Unknown quotation expiry worker error";
            yield logsService.error("Quotation expiry sweep failed", {
                error: errorMessage,
            });
        }
        finally {
            isRunning = false;
        }
    });
    void runSweep();
    const timer = setInterval(() => {
        void runSweep();
    }, intervalMs);
    timer.unref();
    void logsService.info("Quotation expiry worker started", {
        intervalMs,
    });
};
exports.startQuotationExpiryWorker = startQuotationExpiryWorker;
