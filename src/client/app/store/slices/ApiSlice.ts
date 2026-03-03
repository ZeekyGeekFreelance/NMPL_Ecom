import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { logout } from "./AuthSlice";
import { API_BASE_URL } from "@/app/lib/constants/config";
import { emitAuthSyncEvent } from "@/app/lib/authSyncChannel";
import { clearPendingAuthIntent } from "@/app/lib/authIntent";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

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

  if (!hasHeaderValue(headers, "x-idempotency-key")) {
    return {
      ...args,
      headers: mergeHeaders(headers, {
        "x-idempotency-key": createIdempotencyKey(),
      }),
    };
  }

  return args;
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

let refreshRequestPromise: Promise<any> | null = null;

const refreshAuthToken = (api: any, extraOptions: any) => {
  if (!refreshRequestPromise) {
    refreshRequestPromise = Promise.resolve(
      baseQuery(
        { url: "/auth/refresh-token", method: "POST" },
        api,
        extraOptions
      )
    ).finally(() => {
      refreshRequestPromise = null;
    });
  }

  return refreshRequestPromise;
};

const baseQueryWithReauth = async (args, api, extraOptions) => {
  const requestArgs = withMutationSafetyHeaders(args);

  let result = await baseQuery(requestArgs, api, extraOptions);

  if (result.error?.status === 401) {
    const normalizedUrl = normalizeUrlPath(getRequestMeta(requestArgs).url);
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
      result = await baseQuery(requestArgs, api, extraOptions);
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
  ],
  endpoints: () => ({}),
});

