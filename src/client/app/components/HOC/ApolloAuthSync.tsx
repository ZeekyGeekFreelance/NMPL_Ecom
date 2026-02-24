"use client";

import { useApolloClient } from "@apollo/client";
import { useEffect, useRef } from "react";
import { useAuth } from "@/app/hooks/useAuth";

const getAuthSignature = (
  user:
    | {
        id: string;
        accountReference?: string;
        role: string;
        isDealer?: boolean;
        dealerStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
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
      if (process.env.NODE_ENV !== "production") {
        console.error("Apollo resetStore failed after auth change", error);
      }
    });
  }, [
    apolloClient,
    isLoading,
    user?.id,
    user?.role,
    user?.isDealer,
    user?.dealerStatus,
  ]);

  return null;
}
