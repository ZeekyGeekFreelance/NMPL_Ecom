"use client";

import { usePathname } from "next/navigation";
import { shouldTreatAuthAsLoading } from "@/app/lib/authRoutePolicy";
import { useAppSelector } from "./state/useRedux";

export function useAuth() {
  const user = useAppSelector((state) => state.auth.user);
  const pathname = usePathname();

  return {
    user,
    isAuthenticated: !!user,
    isLoading: shouldTreatAuthAsLoading(pathname, user),
  };
}
