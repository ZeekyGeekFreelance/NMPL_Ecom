import { PrismaClient } from "@prisma/client";
import { config } from "@/config";
import { recordQueryMetric } from "@/shared/observability/requestMetrics";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: config.database.url,
    },
  },
});

if (config.isDevelopment) {
  prisma.$use(async (params, next) => {
    const startedAt = performance.now();
    const result = await next(params);
    const durationMs = performance.now() - startedAt;

    recordQueryMetric({
      model: params.model || "raw",
      action: params.action,
      durationMs,
    });

    return result;
  });
}

export const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log("Database connected successfully.");
  } catch (error) {
    console.error("Database connection failed.", error);
    throw error;
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[db] disconnectDB failed: ${msg}`);
    throw err;
  }
};

export const pingDB = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};

export default prisma;
