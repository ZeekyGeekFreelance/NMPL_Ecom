import cron from "node-cron";
import { DataCleanupWorker } from "./dataCleanup.worker";

const cleanupWorker = new DataCleanupWorker();

// Run cleanup on January 1st every year at 3 AM
// This deletes data older than 1 year, so you always keep the last 12 months
cron.schedule("0 3 1 1 *", async () => {
  console.log("[CRON] Starting yearly data cleanup...");
  
  try {
    const results = await cleanupWorker.runFullCleanup();
    console.log("[CRON] Cleanup completed successfully:", results);
  } catch (error) {
    console.error("[CRON] Cleanup failed:", error);
  }
});

console.log("[CRON] Data cleanup job scheduled: January 1st every year at 3 AM (keeps last 12 months)");

export { cleanupWorker };
