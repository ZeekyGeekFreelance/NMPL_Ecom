import { config } from "@/config";

const isDevelopment = config.isDevelopment;
const debugLog = (...args: unknown[]) => {
  if (isDevelopment) {
    console.log(...args);
  }
};

export {};

