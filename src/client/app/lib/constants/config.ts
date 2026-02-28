const DEV_API_URL = "http://localhost:5000/api/v1";
const PROD_API_URL = "https://full-stack-ecommerce-n5at.onrender.com/api/v1";
const DEFAULT_PLATFORM_NAME = "NMPL";
const DEFAULT_SUPPORT_EMAIL = "support@nmpl.local";

export const normalizeApiBaseUrl = (value: string) => {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return trimmed;
  }

  if (/\/api\/v1$/i.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed}/api/v1`;
};

const genericApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim() || "";
const devApiUrlFromEnv =
  process.env.NEXT_PUBLIC_API_URL_DEV?.trim() || genericApiUrl;
const prodApiUrlFromEnv =
  process.env.NEXT_PUBLIC_API_URL_PROD?.trim() || genericApiUrl;

export const PLATFORM_NAME =
  process.env.NEXT_PUBLIC_PLATFORM_NAME?.trim() || DEFAULT_PLATFORM_NAME;

export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || DEFAULT_SUPPORT_EMAIL;

export const API_BASE_URL =
  process.env.NODE_ENV === "production"
    ? normalizeApiBaseUrl(prodApiUrlFromEnv || PROD_API_URL)
    : normalizeApiBaseUrl(devApiUrlFromEnv || DEV_API_URL);

export const AUTH_API_BASE_URL =
  process.env.NODE_ENV === "production"
    ? normalizeApiBaseUrl(prodApiUrlFromEnv || PROD_API_URL)
    : normalizeApiBaseUrl(devApiUrlFromEnv || DEV_API_URL);

export const GRAPHQL_URL = `${API_BASE_URL}/graphql`;
