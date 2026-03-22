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
 * Fix: health probing now tries both the raw NEXT_PUBLIC_API_URL host and the
 * runtime-resolved API host. This preserves the original localhost-friendly
 * behavior for same-machine development while also allowing LAN / non-local
 * browser hosts to mark the backend ready and unlock client-side catalog
 * queries such as the /shop page.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { runtimeEnv } from "@/app/lib/runtimeEnv";

const INITIAL_POLL_INTERVAL_MS =
  parseInt(process.env.NEXT_PUBLIC_BACKEND_READY_POLL_MS || "0", 10) || 2_000;
const MAX_POLL_INTERVAL_MS =
  parseInt(process.env.NEXT_PUBLIC_BACKEND_READY_MAX_POLL_MS || "0", 10) ||
  30_000;
const WARN_AFTER_MS =
  parseInt(process.env.NEXT_PUBLIC_BACKEND_READY_WARN_AFTER_MS || "0", 10) ||
  300_000;

const normalizeHealthBaseUrl = (value: string): string => {
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed.replace(/\/api\/v1\/?$/i, "");
};

const buildHealthUrls = (): string[] => {
  const candidates = new Set<string>();

  const addCandidate = (value: string | undefined) => {
    if (!value || typeof value !== "string") {
      return;
    }

    const base = normalizeHealthBaseUrl(value);
    if (!base) {
      return;
    }

    candidates.add(`${base}/health`);
  };

  // Raw env target: best for same-machine localhost development.
  addCandidate(process.env.NEXT_PUBLIC_API_URL);

  // Runtime-resolved API target: best for LAN/dev access where the browser host
  // differs from the configured env host (for example 192.168.x.x instead of
  // localhost). This preserves the previous localhost fix while avoiding a
  // permanent false-negative backendReady state on non-local hosts.
  addCandidate(runtimeEnv.apiBaseUrl);

  return Array.from(candidates);
};

const HEALTH_URLS = buildHealthUrls();

let sharedBackendReady = typeof window === "undefined";
let sharedPollingPromise: Promise<void> | null = null;
const readySubscribers = new Set<(ready: boolean) => void>();

const notifyReadySubscribers = () => {
  readySubscribers.forEach((listener) => listener(sharedBackendReady));
};

const pingHealth = async (): Promise<boolean> => {
  for (const healthUrl of HEALTH_URLS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2_000);
    try {
      const response = await fetch(healthUrl, {
        method: "GET",
        credentials: "omit",
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        continue;
      }
      const json = await response.json();
      if (json?.healthy === true) {
        return true;
      }
    } catch {
      clearTimeout(timeoutId);
    }
  }

  return false;
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const ensureSharedHealthPolling = () => {
  if (typeof window === "undefined") {
    return;
  }

  if (sharedBackendReady || sharedPollingPromise) {
    return;
  }

  sharedPollingPromise = (async () => {
    let pollIntervalMs = INITIAL_POLL_INTERVAL_MS;
    let warningLogged = false;
    const startedAt = Date.now();

    while (!sharedBackendReady) {
      const healthy = await pingHealth();

      if (healthy) {
        sharedBackendReady = true;
        notifyReadySubscribers();
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

      await sleep(pollIntervalMs);
      pollIntervalMs = Math.min(
        MAX_POLL_INTERVAL_MS,
        Math.round(pollIntervalMs * 1.6)
      );
    }
  })().finally(() => {
    sharedPollingPromise = null;
  });
};

export const useBackendReady = (): boolean => {
  const isServer = typeof window === "undefined";
  const [ready, setReady] = useState<boolean>(isServer || sharedBackendReady);
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (isServer) return;
    if (sharedBackendReady) {
      setReady(true);
      return;
    }

    if (!subscribedRef.current) {
      const handleReadyChange = (nextReady: boolean) => {
        if (nextReady) {
          setReady(true);
        }
      };

      readySubscribers.add(handleReadyChange);
      subscribedRef.current = true;

      ensureSharedHealthPolling();

      return () => {
        readySubscribers.delete(handleReadyChange);
        subscribedRef.current = false;
      };
    }

    ensureSharedHealthPolling();
  }, [isServer]);

  return ready;
};
