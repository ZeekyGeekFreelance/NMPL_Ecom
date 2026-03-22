import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { logout } from "./AuthSlice";
import { API_BASE_URL } from "@/app/lib/constants/config";
import { emitAuthSyncEvent } from "@/app/lib/authSyncChannel";
import { clearPendingAuthIntent } from "@/app/lib/authIntent";
import {
  captureCsrfTokenFromHeaders,
  getCsrfToken,
  hasCsrfToken,
} from "@/app/lib/csrfToken";
import { normalizePayloadTextFields } from "@/app/lib/textNormalization";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const CSRF_BOOTSTRAP_URL = "/csrf";
const MAX_CSRF_BOOTSTRAP_ATTEMPTS = 4;
const MAX_RETRIES_FOR_MUTATION = 1;
const MAX_RETRIES_FOR_QUERY = 2;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const getBackoffDelayMs = (attempt: number) => {
  const baseMs = 300;
  const capMs = 5_000;
  const ceiling = Math.min(capMs, baseMs * Math.pow(2, attempt - 1));
  return Math.round(ceiling * (0.5 + Math.random() * 0.5));
};

const getHeaderEntries = (headers: unknown): Array<[string, string]> => {
  if (!headers) {
    return [];
  }

  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return Array.from(headers.entries()).map(([key, value]) => [key, String(value)]);
  }

  if (Array.isArray(headers)) {
    return headers.map(([key, value]) => [String(key), String(value)]);
  }

  if (typeof headers === "object") {
    return Object.entries(headers as Record<string, unknown>).map(([key, value]) => [
      key,
      String(value),
    ]);
  }

  return [];
};

const hasHeaderValue = (
  headers: unknown,
  headerName: string,
  expectedValue?: string
) => {
  const normalizedName = headerName.toLowerCase();
  const normalizedExpectedValue = expectedValue?.toLowerCase();

  return getHeaderEntries(headers).some(([key, value]) => {
    if (key.toLowerCase() !== normalizedName) {
      return false;
    }

    if (!normalizedExpectedValue) {
      return true;
    }

    return value.toLowerCase() === normalizedExpectedValue;
  });
};

const mergeHeaders = (
  headers: unknown,
  updates: Record<string, string>
): Record<string, string> => {
  const merged = new Map<string, string>();

  getHeaderEntries(headers).forEach(([key, value]) => {
    merged.set(key.toLowerCase(), value);
  });

  Object.entries(updates).forEach(([key, value]) => {
    merged.set(key.toLowerCase(), value);
  });

  return Object.fromEntries(merged.entries());
};

const createIdempotencyKey = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `mut-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const getRequestMeta = (args: any) => {
  if (typeof args === "string") {
    return {
      url: args,
      method: "GET",
      headers: undefined as Record<string, string> | undefined,
    };
  }

  return {
    url: args?.url || "",
    method: (args?.method || "GET").toUpperCase(),
    headers: args?.headers as Record<string, string> | undefined,
  };
};

const isMutationMethod = (method: string) => MUTATION_METHODS.has(method.toUpperCase());

const requiresCsrfBootstrap = (method: string, normalizedUrl: string) =>
  isMutationMethod(method) &&
  normalizedUrl !== CSRF_BOOTSTRAP_URL &&
  normalizedUrl.length > 0;

const normalizeUrlPath = (url: unknown) => {
  if (typeof url !== "string" || !url) {
    return "";
  }

  const [path] = url.split("?");
  if (!path) {
    return "";
  }

  return path.startsWith("/") ? path : `/${path}`;
};

const isRetryableError = (error: any): boolean => {
  const status = error?.status;

  if (typeof status === "number") {
    return RETRYABLE_STATUS_CODES.has(status);
  }

  return (
    status === "FETCH_ERROR" ||
    status === "TIMEOUT_ERROR" ||
    status === "PARSING_ERROR"
  );
};

const isAuthEndpoint = (normalizedUrl: string) =>
  normalizedUrl.startsWith("/auth/");
const isBootstrapAuthProfileEndpoint = (normalizedUrl: string) =>
  normalizedUrl === "/users/me";

const getAuthUserFromState = (api: any) => {
  const state = api.getState() as { auth?: { user?: unknown | null } };
  return state?.auth?.user;
};

const withMutationSafetyHeaders = (args: any) => {
  if (typeof args === "string") {
    return args;
  }

  const { method, headers } = getRequestMeta(args);

  if (!MUTATION_METHODS.has(method)) {
    return args;
  }

  const updates: Record<string, string> = {};

  if (!hasHeaderValue(headers, "x-idempotency-key")) {
    updates["x-idempotency-key"] = createIdempotencyKey();
  }

  const csrfToken = getCsrfToken();
  if (csrfToken && !hasHeaderValue(headers, "x-csrf-token")) {
    updates["x-csrf-token"] = csrfToken;
  }

  if (Object.keys(updates).length > 0) {
    return {
      ...args,
      headers: mergeHeaders(headers, updates),
    };
  }

  return args;
};

const shouldNormalizeRequestBody = (body: unknown): boolean => {
  if (!body || typeof body !== "object") {
    return false;
  }

  if (typeof FormData !== "undefined" && body instanceof FormData) {
    return false;
  }

  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
    return false;
  }

  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return false;
  }

  if (body instanceof ArrayBuffer) {
    return false;
  }

  return true;
};

const withNormalizedMutationBody = (args: any) => {
  if (typeof args === "string") {
    return args;
  }

  const { method } = getRequestMeta(args);
  if (!MUTATION_METHODS.has(method)) {
    return args;
  }

  if (!shouldNormalizeRequestBody(args?.body)) {
    return args;
  }

  return {
    ...args,
    body: normalizePayloadTextFields(args.body),
  };
};

const shouldAttemptTokenRefresh = (
  normalizedUrl: string,
  authUser: unknown | null | undefined
) => {
  if (authUser === null) {
    return false;
  }

  if (!normalizedUrl) {
    return authUser !== null && authUser !== undefined;
  }

  if (normalizedUrl === "/auth/refresh-token") {
    return false;
  }

  if (isAuthEndpoint(normalizedUrl)) {
    return false;
  }

  // Before auth bootstrap resolves (authUser === undefined), only
  // `/users/me` may legitimately require refresh. This avoids refresh spam
  // for unrelated public/optional requests that return 401.
  if (authUser === undefined) {
    return isBootstrapAuthProfileEndpoint(normalizedUrl);
  }

  return true;
};

const shouldSyncUnauthorizedState = (
  normalizedUrl: string,
  authUser: unknown | null | undefined
) => {
  if (authUser) {
    return true;
  }

  return authUser === undefined && isBootstrapAuthProfileEndpoint(normalizedUrl);
};

const handleUnauthorizedState = (api: any) => {
  const authUser = getAuthUserFromState(api);

  // `null` means we already know this tab is signed out.
  if (authUser === null) {
    return;
  }

  api.dispatch(apiSlice.util.resetApiState());
  api.dispatch(logout());
  clearPendingAuthIntent();

  if (authUser) {
    emitAuthSyncEvent("SIGNED_OUT");
  }
};

const baseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  credentials: "include",
});

const executeBaseQueryWithRetry = async (
  requestArgs: any,
  api: any,
  extraOptions: any,
  maxRetries: number
) => {
  let attempt = 0;
  let result = await baseQuery(requestArgs, api, extraOptions);
  captureCsrfTokenFromHeaders(result.meta?.response?.headers);

  while (result.error && attempt < maxRetries && isRetryableError(result.error)) {
    attempt += 1;
    await sleep(getBackoffDelayMs(attempt));
    result = await baseQuery(requestArgs, api, extraOptions);
    captureCsrfTokenFromHeaders(result.meta?.response?.headers);
  }

  return result;
};

let csrfBootstrapPromise: Promise<boolean> | null = null;

const bootstrapCsrfToken = async (api: any, extraOptions: any): Promise<boolean> => {
  if (typeof document === "undefined") {
    return true;
  }

  if (hasCsrfToken()) {
    return true;
  }

  for (let attempt = 1; attempt <= MAX_CSRF_BOOTSTRAP_ATTEMPTS; attempt++) {
    const result = await executeBaseQueryWithRetry(
      { url: CSRF_BOOTSTRAP_URL, method: "GET" },
      api,
      extraOptions,
      0
    );

    if (!result.error && hasCsrfToken()) {
      return true;
    }

    if (attempt < MAX_CSRF_BOOTSTRAP_ATTEMPTS) {
      await sleep(getBackoffDelayMs(attempt));
    }
  }

  return hasCsrfToken();
};

const ensureCsrfToken = (api: any, extraOptions: any): Promise<boolean> => {
  if (typeof document === "undefined" || hasCsrfToken()) {
    return Promise.resolve(true);
  }

  if (!csrfBootstrapPromise) {
    csrfBootstrapPromise = bootstrapCsrfToken(api, extraOptions).finally(() => {
      csrfBootstrapPromise = null;
    });
  }

  return csrfBootstrapPromise;
};

let refreshRequestPromise: Promise<any> | null = null;

const refreshAuthToken = (api: any, extraOptions: any) => {
  if (!refreshRequestPromise) {
    refreshRequestPromise = Promise.resolve(
      (async () => {
        return executeBaseQueryWithRetry(
          { url: "/auth/refresh-token", method: "POST" },
          api,
          extraOptions,
          MAX_RETRIES_FOR_MUTATION
        );
      })()
    ).finally(() => {
      refreshRequestPromise = null;
    });
  }

  return refreshRequestPromise;
};

const baseQueryWithReauth = async (args, api, extraOptions) => {
  const normalizedBodyArgs = withNormalizedMutationBody(args);
  const requestMeta = getRequestMeta(normalizedBodyArgs);
  const normalizedUrl = normalizeUrlPath(requestMeta.url);

  if (requiresCsrfBootstrap(requestMeta.method, normalizedUrl)) {
    const csrfReady = await ensureCsrfToken(api, extraOptions);
    if (!csrfReady) {
      return {
        error: {
          status: 503,
          data: {
            message:
              "Security token initialization failed. Please refresh and try again.",
          },
        },
      };
    }
  }

  const requestArgs = withMutationSafetyHeaders(normalizedBodyArgs);
  const maxRetries = isMutationMethod(requestMeta.method)
    ? MAX_RETRIES_FOR_MUTATION
    : MAX_RETRIES_FOR_QUERY;

  let result = await executeBaseQueryWithRetry(
    requestArgs,
    api,
    extraOptions,
    maxRetries
  );

  if (result.error?.status === 401) {
    const authUser = getAuthUserFromState(api);

    if (!shouldAttemptTokenRefresh(normalizedUrl, authUser)) {
      if (
        !isAuthEndpoint(normalizedUrl) &&
        shouldSyncUnauthorizedState(normalizedUrl, authUser)
      ) {
        handleUnauthorizedState(api);
      }
      return result;
    }

    // Try refresh the token
    const refreshResult = await refreshAuthToken(api, extraOptions);

    if (refreshResult.data) {
      // If there's data, retry the original req with the new token
      result = await executeBaseQueryWithRetry(
        requestArgs,
        api,
        extraOptions,
        maxRetries
      );
      if (
        result.error?.status === 401 &&
        shouldSyncUnauthorizedState(normalizedUrl, authUser)
      ) {
        handleUnauthorizedState(api);
      }
    } else {
      // If refresh fails, clear local auth state once.
      if (shouldSyncUnauthorizedState(normalizedUrl, authUser)) {
        handleUnauthorizedState(api);
      }
    }
  }

  return result;
};

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    "User",
    "Product",
    "Category",
    "Address",
    "Cart",
    "Order",
    "Section",
    "Transactions",
    "Logs",
    "Attribute",
    "Variant",
    "DeliveryRate",
    // Payment-related tags (used by paymentApiSlice which injects into this slice)
    "OutstandingPayments",
    "CreditLedger",
    "PaymentAudit",
    "Dealers",
    "DealerPrices",
  ],
  endpoints: () => ({}),
});
