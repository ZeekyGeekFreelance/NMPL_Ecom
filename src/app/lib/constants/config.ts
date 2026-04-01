import { runtimeEnv } from "@/app/lib/runtimeEnv";

export const PLATFORM_NAME = runtimeEnv.platformName;
export const SUPPORT_EMAIL = runtimeEnv.supportEmail;
// In v99, all API calls use /api/* (internal Next.js routes)
export const API_BASE_URL = "/api";
export const AUTH_API_BASE_URL = "/api";
// GraphQL is not used in v99 - kept for type compatibility only
export const GRAPHQL_URL = "";
