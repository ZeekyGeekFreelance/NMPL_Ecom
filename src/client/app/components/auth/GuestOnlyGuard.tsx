"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/hooks/useAuth";

interface GuestOnlyGuardProps {
  children: ReactNode;
}

const GuestOnlyGuard = ({ children }: GuestOnlyGuardProps) => {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    const isAdmin = user?.role === "ADMIN" || user?.role === "SUPERADMIN";
    router.replace(isAdmin ? "/dashboard" : "/");
  }, [isAuthenticated, isLoading, router, user?.role]);

  if (isAuthenticated) return null;

  return <>{children}</>;
};

export default GuestOnlyGuard;
