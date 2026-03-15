import cron from "node-cron";
import { DataCleanupWorker } from "./dataCleanup.worker";

/**
 * NMPL Data Lifecycle Cron Jobs
 *
 * Schedule:
 *   - Annual (Jan 1, 3 AM IST): delete canceled orders >7 years old with no
 *     financial records, soft-archive unsold products inactive for 2+ years.
 *
 * COMPLIANCE: Financial records (invoices, payment transactions, audit logs,
 * credit ledger entries) are NEVER touched by any scheduled job. See
 * dataCleanup.worker.ts for the full retention policy.
 */
const cleanupWorker = new DataCleanupWorker();

// 1st of every month at 03:00 AM
cron.schedule("0 3 1 * *", async () => {
  console.log("[CRON] Starting monthly data lifecycle job...");

  try {
    const results = await cleanupWorker.runFullCleanup();
    console.log("[CRON] Monthly cleanup completed:", results);
  } catch (error) {
    console.error("[CRON] Monthly cleanup failed:", error);
  }
});

console.log(
  "[CRON] Monthly data lifecycle job scheduled: 1st of every month at 03:00 AM. " +
  "Financial records (invoices, payments, audit logs) are never deleted."
);

export { cleanupWorker };
