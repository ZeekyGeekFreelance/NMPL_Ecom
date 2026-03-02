import { PrismaClient } from "@prisma/client";
import { config } from "@/config";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: config.database.url,
    },
  },
});

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
  await prisma.$disconnect();
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
