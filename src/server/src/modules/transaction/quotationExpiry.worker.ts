import { makeLogsService } from "../logs/logs.factory";
import { TransactionRepository } from "./transaction.repository";
import { TransactionService } from "./transaction.service";
import { getReservationSweepSeconds } from "@/shared/utils/orderLifecycle";

let workerInitialized = false;

export const startQuotationExpiryWorker = (): void => {
  if (workerInitialized) {
    return;
  }

  workerInitialized = true;
  const logsService = makeLogsService();
  const service = new TransactionService(new TransactionRepository());
  const intervalMs = getReservationSweepSeconds() * 1000;
  let isRunning = false;

  const runSweep = async () => {
    if (isRunning) {
      return;
    }
    isRunning = true;

    try {
      const expiredCount = await service.processExpiredQuotations();
      if (expiredCount > 0) {
        await logsService.info("Expired quotations processed", {
          expiredCount,
        });
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown quotation expiry worker error";
      await logsService.error("Quotation expiry sweep failed", {
        error: errorMessage,
      });
    } finally {
      isRunning = false;
    }
  };

  void runSweep();
  const timer = setInterval(() => {
    void runSweep();
  }, intervalMs);
  timer.unref();

  void logsService.info("Quotation expiry worker started", {
    intervalMs,
  });
};
