"use client";

import { useApolloClient } from "@apollo/client";
import { useEffect, useRef } from "react";
import { useAuth } from "@/app/hooks/useAuth";
import { runtimeEnv } from "@/app/lib/runtimeEnv";

const getAuthSignature = (
  user:
    | {
        id: string;
        accountReference?: string;
        role: string;
        effectiveRole?: "USER" | "DEALER" | "ADMIN" | "SUPERADMIN";
        isDealer?: boolean;
        dealerStatus?:
          | "PENDING"
          | "APPROVED"
          | "LEGACY"
          | "REJECTED"
          | "SUSPENDED"
          | null;
      }
    | null
    | undefined
) => {
  if (!user) {
    return "ANON";
  }

  return [
    user.id,
    user.role,
    user.effectiveRole || "no-effective-role",
    user.isDealer ? "dealer" : "non-dealer",
    user.dealerStatus || "no-dealer-status",
  ].join("|");
};

export default function ApolloAuthSync() {
  const apolloClient = useApolloClient();
  const { user, isLoading } = useAuth();
  const previousSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const nextSignature = getAuthSignature(user);
    const previousSignature = previousSignatureRef.current;
    previousSignatureRef.current = nextSignature;

    if (previousSignature === null || previousSignature === nextSignature) {
      return;
    }

    // Ensure role-sensitive GraphQL data (e.g., dealer pricing) is refreshed.
    apolloClient.resetStore().catch((error) => {
      if (!runtimeEnv.isProduction) {
        console.error("Apollo resetStore failed after auth change", error);
      }
    });
  }, [
    apolloClient,
    isLoading,
    user?.id,
    user?.role,
    user?.effectiveRole,
    user?.isDealer,
    user?.dealerStatus,
  ]);

  return null;
}
