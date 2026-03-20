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

/**
 * ApolloAuthSync
 *
 * Resets the Apollo cache whenever the authenticated identity changes so that
 * role-sensitive data (e.g. dealer pricing) is never served stale to a
 * different user.
 *
 * Fix: resetStore() is now skipped on the very first auth resolution
 * (previousSignature === null → bootSignature is set). The initial bootstrap
 * sequence is:
 *   1. isAuthChecking = true  → effect bails out early (isLoading guard)
 *   2. GET /users/me resolves → user becomes null ("ANON") or a real User
 *   3. Effect fires with previousSignature === null
 *
 * Previously, step 3 would fall through to resetStore() whenever the
 * previousSignature transitioned from a stale Redux-persisted userId to "ANON"
 * (or any value). This cancelled in-flight GET_PRODUCTS queries mid-flight
 * because resetStore() aborts all active queries. RetryLink couldn't recover
 * them because the shop page's `skip: !backendReady` suppressed re-execution.
 * Result: "Failed to fetch products" on every cold load.
 *
 * The fix records the initial signature without resetting. Subsequent genuine
 * auth changes (sign-in, sign-out, dealer status upgrade) still trigger a full
 * resetStore() as intended.
 */
export default function ApolloAuthSync() {
  const apolloClient = useApolloClient();
  const { user, isLoading } = useAuth();
  // null  = bootstrap not yet complete (no signature recorded)
  // string = last known stable signature
  const previousSignatureRef = useRef<string | null>(null);
  // Track whether we have completed the initial bootstrap resolution.
  const bootstrapCompleteRef = useRef(false);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const nextSignature = getAuthSignature(user);
    const previousSignature = previousSignatureRef.current;

    // First resolution after mount: record the initial auth state without
    // resetting the store. Product queries are already in-flight at this point
    // and must not be cancelled.
    if (!bootstrapCompleteRef.current) {
      bootstrapCompleteRef.current = true;
      previousSignatureRef.current = nextSignature;
      return;
    }

    // Update the stored signature regardless of whether we reset, so the next
    // comparison is always against the most recent stable state.
    previousSignatureRef.current = nextSignature;

    // No meaningful change — nothing to do.
    if (previousSignature === nextSignature) {
      return;
    }

    // Genuine auth transition after bootstrap (sign-in, sign-out, role change).
    // Reset the store so stale role-sensitive data is evicted.
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
