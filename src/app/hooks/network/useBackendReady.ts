"use client";
/**
 * useBackendReady for v99.
 * Since v99 is a self-contained full-stack Next.js app with internal API routes,
 * the backend is always ready (it's the same process as the frontend).
 */
export const useBackendReady = (): boolean => true;
