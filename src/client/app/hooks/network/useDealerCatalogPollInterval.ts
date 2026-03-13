"use client";

import { useMemo } from "react";
import { useAuth } from "@/app/hooks/useAuth";
import { resolveDisplayRole } from "@/app/lib/userRole";
import { runtimeEnv } from "@/app/lib/runtimeEnv";

const MIN_POLL_INTERVAL_MS = 5000;

const configuredPollInterval =
  typeof runtimeEnv.dealerCatalogPollMs === "number"
    ? Math.max(runtimeEnv.dealerCatalogPollMs, MIN_POLL_INTERVAL_MS)
    : undefined;

export const useDealerCatalogPollInterval = (enabled = true): number | undefined => {
  const { isAuthenticated, user } = useAuth();

  return useMemo(() => {
    if (!enabled || !isAuthenticated || !user) {
      return undefined;
    }

    const isApprovedDealer =
      resolveDisplayRole(user) === "DEALER" && user.dealerStatus === "APPROVED";

    if (!isApprovedDealer) {
      return undefined;
    }

    return configuredPollInterval;
  }, [enabled, isAuthenticated, user]);
};

