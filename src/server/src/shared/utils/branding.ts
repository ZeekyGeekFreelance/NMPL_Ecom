import { config } from "@/config";

export const getPlatformName = (): string => config.branding.platformName;

export const getSupportEmail = (): string => config.branding.supportEmail;
