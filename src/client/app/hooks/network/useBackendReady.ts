/**
 * useBackendReady.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Polls the backend /health endpoint until it reports {"healthy":true}, then
 * resolves to `true`.  Components that depend on live API data can gate their
 * first fetch behind this hook to avoid the "Failed to fetch products" flash
 * that occurs when the client starts before the server has finished cold-starting.
 *
 * Usage:
 *   const backendReady = useBackendReady();
 *   const { data } = useQuery(GET_PRODUCTS, { skip: !backendReady });
 *
 * The hook is a no-op (immediately ready) when:
 *   • The server already responds healthy on first check (normal case once warm).
 *   • The component is rendered on the server (SSR) — there is no window to poll.
 *
 * Configuration (via env):
 *   NEXT_PUBLIC_BACKEND_READY_POLL_MS  — interval between polls (default 3000ms)
 *   NEXT_PUBLIC_BACKEND_READY_TIMEOUT_MS — give up after this long (default 300000ms / 5min)
 */

"use client";
import { useState, useEffect, useRef } from "react";
import { API_BASE_URL } from "@/app/lib/constants/config";

const POLL_INTERVAL_MS =
  parseInt(process.env.NEXT_PUBLIC_BACKEND_READY_POLL_MS || "0", 10) || 2_000;

const TIMEOUT_MS =
  parseInt(process.env.NEXT_PUBLIC_BACKEND_READY_TIMEOUT_MS || "0", 10) ||
  300_000; // 5 minutes — enough for any cold-start scenario

const HEALTH_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, "") + "/health";

/**
 * Ping the backend health endpoint once.
 * Returns true only if the response contains `"healthy":true`.
 * Never throws — all errors are treated as "not ready yet".
 */
const pingHealth = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    // 2s per ping — fast enough to detect a live server, short enough that a
    // hung/slow server doesn't stall the poll loop for more than 2s per cycle.
    const timeoutId = setTimeout(() => controller.abort(), 2_000);
    const response = await fetch(HEALTH_URL, {
      method: "GET",
      // credentials: 'omit' — /health needs no auth cookie, avoids CORS preflight
      // on cross-origin requests (e.g. client on :3000 → server on :5000).
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
  // Hooks must always be called unconditionally (Rules of Hooks).
  // We initialise to true on SSR so the server render never blocks,
  // and to false on the client so we wait for the first health check.
  const isServer = typeof window === "undefined";

  const [ready, setReady] = useState<boolean>(isServer);
  const timedOutRef = useRef(false);
  const readyRef = useRef(false);

  useEffect(() => {
    // On SSR the effect never runs, so nothing to do.
    if (isServer) return;
    // If already confirmed ready (e.g. fast server), skip.
    if (readyRef.current) return;

    let cancelled = false;

    const timeoutHandle = setTimeout(() => {
      // After TIMEOUT_MS unblock the UI — the query will fail gracefully.
      if (!readyRef.current && !cancelled) {
        timedOutRef.current = true;
        setReady(true);
      }
    }, TIMEOUT_MS);

    const poll = async () => {
      while (!cancelled && !timedOutRef.current) {
        const healthy = await pingHealth();
        if (cancelled) break;
        if (healthy) {
          readyRef.current = true;
          setReady(true);
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    };

    void poll();

    return () => {
      cancelled = true;
      clearTimeout(timeoutHandle);
    };
  }, []);

  return ready;
};
