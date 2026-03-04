import { runSeedOrchestrator } from "../prisma/seed";

runSeedOrchestrator().catch((error) => {
  console.error("[seeds/seed.ts] Deprecated entrypoint failed:", error);
  process.exit(1);
});
