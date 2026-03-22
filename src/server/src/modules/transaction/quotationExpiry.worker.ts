import { makeLogsService } from "../logs/logs.factory";

let workerInitialized = false;

export const startQuotationExpiryWorker = (): void => {
  if (workerInitialized) {
    return;
  }

  workerInitialized = true;
  const logsService = makeLogsService();
  void logsService.info("Quotation expiry worker disabled", {
    policy: "manual_follow_up",
  });
};
