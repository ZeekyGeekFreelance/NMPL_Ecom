"use client";

import { useMemo } from "react";
import { useAuth } from "@/app/hooks/useAuth";
import { resolveDisplayRole } from "@/app/lib/userRole";

const DEFAULT_POLL_INTERVAL_MS = 15000;
const MIN_POLL_INTERVAL_MS = 5000;

const resolveConfiguredPollInterval = () => {
  const raw = process.env.NEXT_PUBLIC_DEALER_CATALOG_POLL_MS;
  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_POLL_INTERVAL_MS;
  }

  return Math.max(Math.floor(parsed), MIN_POLL_INTERVAL_MS);
};

const configuredPollInterval = resolveConfiguredPollInterval();

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

