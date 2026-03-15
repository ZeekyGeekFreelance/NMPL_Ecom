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

// January 1st at 03:00 AM every year
cron.schedule("0 3 1 1 *", async () => {
  console.log("[CRON] Starting annual data lifecycle job...");

  try {
    const results = await cleanupWorker.runFullCleanup();
    console.log("[CRON] Annual cleanup completed:", results);
  } catch (error) {
    console.error("[CRON] Annual cleanup failed:", error);
  }
});

console.log(
  "[CRON] Annual data lifecycle job scheduled: January 1st at 03:00 AM. " +
  "Financial records (invoices, payments, audit logs) are never deleted."
);

export { cleanupWorker };
