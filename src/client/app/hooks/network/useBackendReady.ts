/**
 * useBackendReady.ts
 *
 * Polls the backend /health endpoint until it reports {"healthy": true},
 * then resolves to true. Components can gate API calls behind this hook
 * so product/auth requests are never fired before backend readiness.
 *
 * Configuration (via env):
 *   NEXT_PUBLIC_BACKEND_READY_POLL_MS       initial poll interval (default 2000ms)
 *   NEXT_PUBLIC_BACKEND_READY_MAX_POLL_MS   max backoff interval (default 30000ms)
 *   NEXT_PUBLIC_BACKEND_READY_WARN_AFTER_MS warning threshold (default 300000ms)
 *
 * Fix: HEALTH_URL is derived from the raw NEXT_PUBLIC_API_URL env variable,
 * NOT from the runtime-rewritten API_BASE_URL. runtimeEnv.ts rewrites the
 * hostname to window.location.hostname for LAN dev access — which is correct
 * for API calls but breaks the health check URL when the server is bound only
 * to localhost. Using the raw env value keeps the health URL stable and
 * consistent with the server's actual listening address.
 */

"use client";

import { useEffect, useRef, useState } from "react";

const INITIAL_POLL_INTERVAL_MS =
  parseInt(process.env.NEXT_PUBLIC_BACKEND_READY_POLL_MS || "0", 10) || 2_000;
const MAX_POLL_INTERVAL_MS =
  parseInt(process.env.NEXT_PUBLIC_BACKEND_READY_MAX_POLL_MS || "0", 10) ||
  30_000;
const WARN_AFTER_MS =
  parseInt(process.env.NEXT_PUBLIC_BACKEND_READY_WARN_AFTER_MS || "0", 10) ||
  300_000;

// Build the health URL from the raw env var, stripping any trailing /api/v1
// path that normalizeApiBaseUrl may have appended. This avoids the host-
// rewrite that runtimeEnv.resolveDevApiBaseUrl applies to API_BASE_URL and
// ensures the health ping always targets the server's real listening address.
const buildHealthUrl = (): string => {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
  const base = raw.replace(/\/api\/v1\/?$/i, "");
  return `${base}/health`;
};

const HEALTH_URL = buildHealthUrl();

const pingHealth = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2_000);
    const response = await fetch(HEALTH_URL, {
      method: "GET",
      credentials: "omit",
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeoutId);
    if (!response.ok) return false;
    const json = await response.json();
    return json?.healthy === true;
  } catch {
    return false;
  }
};

export const useBackendReady = (): boolean => {
  const isServer = typeof window === "undefined";
  const [ready, setReady] = useState<boolean>(isServer);
  const readyRef = useRef(false);

  useEffect(() => {
    if (isServer) return;
    if (readyRef.current) return;

    let cancelled = false;
    let pollIntervalMs = INITIAL_POLL_INTERVAL_MS;
    let warningLogged = false;
    const startedAt = Date.now();

    const poll = async () => {
      while (!cancelled) {
        const healthy = await pingHealth();
        if (cancelled) return;

        if (healthy) {
          readyRef.current = true;
          setReady(true);
          return;
        }

        const elapsedMs = Date.now() - startedAt;
        if (!warningLogged && elapsedMs >= WARN_AFTER_MS) {
          warningLogged = true;
          console.error(
            `[backend-ready] Backend is still not healthy after ${Math.floor(
              elapsedMs / 1000
            )}s. Continuing retries.`
          );
        }

        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        pollIntervalMs = Math.min(
          MAX_POLL_INTERVAL_MS,
          Math.round(pollIntervalMs * 1.6)
        );
      }
    };

    void poll();

    return () => {
      cancelled = true;
    };
  }, [isServer]);

  return ready;
};
