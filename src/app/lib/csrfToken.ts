"use client";

const CSRF_HEADER_NAME = "x-csrf-token";

let inMemoryCsrfToken: string | undefined;

const normalizeToken = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const readCookieToken = (): string | undefined => {
  if (typeof document === "undefined") {
    return undefined;
  }

  const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]+)/);
  return normalizeToken(match?.[1]);
};

export const getCsrfToken = (): string | undefined => {
  return readCookieToken() || inMemoryCsrfToken;
};

export const setCsrfToken = (value: unknown): string | undefined => {
  const token = normalizeToken(value);
  if (token) {
    inMemoryCsrfToken = token;
  }
  return token;
};

export const captureCsrfTokenFromHeaders = (
  headers:
    | Headers
    | { get?: (name: string) => string | null; [key: string]: unknown }
    | undefined
): string | undefined => {
  if (!headers) {
    return undefined;
  }

  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return setCsrfToken(headers.get(CSRF_HEADER_NAME));
  }

  if (typeof headers.get === "function") {
    return setCsrfToken(headers.get(CSRF_HEADER_NAME));
  }

  const record = headers as Record<string, unknown>;
  return setCsrfToken(
    record[CSRF_HEADER_NAME] ??
      record[CSRF_HEADER_NAME.toLowerCase()] ??
      record["X-CSRF-Token"]
  );
};

export const hasCsrfToken = (): boolean => Boolean(getCsrfToken());
