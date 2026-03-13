"use client";

import { useAppSelector } from "./state/useRedux";

export function useAuth() {
  const { user, isAuthChecking } = useAppSelector((state) => state.auth);

  return {
    user,
    isAuthenticated: !!user,
    isLoading:
      typeof isAuthChecking === "boolean" ? isAuthChecking : user === undefined,
  };
}
