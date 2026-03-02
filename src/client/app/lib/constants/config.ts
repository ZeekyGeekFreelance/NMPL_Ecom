import { runtimeEnv } from "@/app/lib/runtimeEnv";

export const PLATFORM_NAME = runtimeEnv.platformName;
export const SUPPORT_EMAIL = runtimeEnv.supportEmail;
export const API_BASE_URL = runtimeEnv.apiBaseUrl;
export const AUTH_API_BASE_URL = runtimeEnv.apiBaseUrl;
export const GRAPHQL_URL = `${API_BASE_URL}/graphql`;

