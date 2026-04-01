"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/hooks/useAuth";
import { resolveDisplayRole } from "@/app/lib/userRole";
import { runtimeEnv } from "@/app/lib/runtimeEnv";

const MIN_POLL_INTERVAL_MS = 5000;

const configuredPollInterval =
  typeof runtimeEnv.dealerCatalogPollMs === "number"
    ? Math.max(runtimeEnv.dealerCatalogPollMs, MIN_POLL_INTERVAL_MS)
    : undefined;
const ACTIVE_DEALER_STATUSES = new Set(["APPROVED", "LEGACY"]);

export const useDealerCatalogPollInterval = (enabled = true): number | undefined => {
  const { isAuthenticated, user } = useAuth();
  const [isDocumentVisible, setIsDocumentVisible] = useState(
    typeof document === "undefined" ? true : document.visibilityState === "visible"
  );

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const handleVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return useMemo(() => {
    if (!enabled || !isAuthenticated || !user || !isDocumentVisible) {
      return undefined;
    }

    const isActiveDealer =
      resolveDisplayRole(user) === "DEALER" &&
      ACTIVE_DEALER_STATUSES.has(String(user.dealerStatus || ""));

    if (!isActiveDealer) {
      return undefined;
    }

    return configuredPollInterval;
  }, [enabled, isAuthenticated, isDocumentVisible, user]);
};

