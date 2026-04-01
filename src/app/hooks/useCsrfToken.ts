"use client";

import { useEffect } from "react";
import axiosInstance from "@/app/utils/axiosInstance";
import { useBackendReady } from "@/app/hooks/network/useBackendReady";
import { hasCsrfToken } from "@/app/lib/csrfToken";

/**
 * Hook to ensure the CSRF token is fetched and stored in cookies.
 * Should be called once at app initialisation (in ClientProviders).
 *
 * Fix: the fetch is now gated behind useBackendReady. Previously the hook
 * fired on mount unconditionally — if the backend was still starting up the
 * /csrf GET returned 503, all 4 retry attempts were exhausted while the server
 * was cold, and the CSRF cookie was never set. When the user then submitted the
 * login form the POST /auth/sign-in hit csrfProtection middleware with no
 * cookie present, returning 403 "CSRF token missing" — surfaced to the user as
 * a mysterious login error.
 *
 * By waiting for backendReady before fetching, we guarantee the server is
 * healthy and can actually set the cookie before any mutation is attempted.
 * A single retry loop with exponential backoff is kept as a safety net for
 * transient failures that occur after the server reports healthy.
 */
export const useCsrfToken = () => {
  const backendReady = useBackendReady();

  useEffect(() => {
    // Do not attempt to fetch until the backend health gate has opened.
    // This prevents burning all retry attempts against a cold server.
    if (!backendReady) return;

    let cancelled = false;
    const MAX_ATTEMPTS = 5;
    const BASE_DELAY_MS = 300;

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      });

    const fetchCsrfToken = async () => {
      if (hasCsrfToken()) return;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (cancelled) return;

        try {
          await axiosInstance.get("/csrf");
          if (hasCsrfToken()) return;
        } catch (error) {
          if (attempt === MAX_ATTEMPTS) {
            console.error(
              "[csrf] Failed to bootstrap CSRF cookie after retries.",
              error
            );
            return;
          }
        }

        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await wait(delay);

        if (hasCsrfToken()) return;
      }
    };

    void fetchCsrfToken();

    return () => {
      cancelled = true;
    };
  }, [backendReady]);
};
