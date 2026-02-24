import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { logout } from "./AuthSlice";
import { API_BASE_URL } from "@/app/lib/constants/config";
import { emitAuthSyncEvent } from "@/app/lib/authSyncChannel";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const CONFIRMATION_REQUIRED_PATHS = [
  /^\/users(\/|$)/,
  /^\/products(\/|$)/,
  /^\/categories(\/|$)/,
  /^\/variants(\/|$)/,
  /^\/attributes(\/|$)/,
  /^\/sections(\/|$)/,
  /^\/transactions(\/|$)/,
  /^\/reports(\/|$)/,
  /^\/shipments(\/|$)/,
  /^\/orders(\/|$)/,
];

const hasConfirmationHandledHeader = (headers: unknown) => {
  if (!headers) {
    return false;
  }

  if (
    typeof Headers !== "undefined" &&
    headers instanceof Headers &&
    headers.get("x-confirmation-handled") === "true"
  ) {
    return true;
  }

  if (Array.isArray(headers)) {
    return headers.some(
      ([key, value]) =>
        String(key).toLowerCase() === "x-confirmation-handled" &&
        String(value).toLowerCase() === "true"
    );
  }

  if (typeof headers === "object") {
    return Object.entries(headers as Record<string, unknown>).some(
      ([key, value]) =>
        key.toLowerCase() === "x-confirmation-handled" &&
        String(value).toLowerCase() === "true"
    );
  }

  return false;
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

const getAuthUserFromState = (api: any) => {
  const state = api.getState() as { auth?: { user?: unknown | null } };
  return state?.auth?.user;
};

const shouldAttemptTokenRefresh = (
  normalizedUrl: string,
  authUser: unknown | null | undefined
) => {
  if (authUser === null) {
    return false;
  }

  if (!normalizedUrl) {
    return true;
  }

  if (normalizedUrl === "/auth/refresh-token") {
    return false;
  }

  if (isAuthEndpoint(normalizedUrl)) {
    return false;
  }

  if (normalizedUrl === "/users/me") {
    return false;
  }

  return true;
};

const handleUnauthorizedState = (api: any) => {
  const authUser = getAuthUserFromState(api);

  // `null` means we already know this tab is signed out.
  if (authUser === null) {
    return;
  }

  api.dispatch(logout());

  if (authUser) {
    emitAuthSyncEvent("SIGNED_OUT");
  }
};

const shouldConfirmMutation = (args: any) => {
  if (typeof window === "undefined") {
    return false;
  }

  const { url, method, headers } = getRequestMeta(args);

  if (!MUTATION_METHODS.has(method)) {
    return false;
  }

  const normalizedUrl = typeof url === "string" ? url : "";

  if (normalizedUrl === "/auth/refresh-token") {
    return false;
  }

  if (hasConfirmationHandledHeader(headers)) {
    return false;
  }

  return CONFIRMATION_REQUIRED_PATHS.some((pattern) =>
    pattern.test(normalizedUrl)
  );
};

const getConfirmationMessage = (args: any) => {
  const { method } = getRequestMeta(args);

  if (method === "DELETE") {
    return "Are you sure you want to permanently delete this entry?";
  }

  return "Are you sure you want to continue? This action will be saved to the database.";
};

const baseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  credentials: "include",
});

const baseQueryWithReauth = async (args, api, extraOptions) => {
  if (shouldConfirmMutation(args)) {
    const isConfirmed = window.confirm(getConfirmationMessage(args));

    if (!isConfirmed) {
      return {
        error: {
          status: 499,
          data: { message: "Action cancelled by user." },
        },
      };
    }
  }

  let result = await baseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    const normalizedUrl = normalizeUrlPath(getRequestMeta(args).url);
    const authUser = getAuthUserFromState(api);

    if (!shouldAttemptTokenRefresh(normalizedUrl, authUser)) {
      if (!isAuthEndpoint(normalizedUrl)) {
        handleUnauthorizedState(api);
      }
      return result;
    }

    // Try refresh the token
    const refreshResult = await baseQuery(
      { url: "/auth/refresh-token", method: "POST" },
      api,
      extraOptions
    );

    if (refreshResult.data) {
      // If there's data, retry the original req with the new token
      result = await baseQuery(args, api, extraOptions);
    } else {
      // If refresh fails, clear local auth state once.
      handleUnauthorizedState(api);
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
    "Cart",
    "Order",
    "Review",
    "Section",
    "Transactions",
    "Logs",
    "Attribute",
    "Variant",
  ],
  endpoints: () => ({}),
});

