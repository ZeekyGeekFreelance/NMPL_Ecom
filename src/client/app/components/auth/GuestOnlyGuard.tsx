"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/hooks/useAuth";
import CustomLoader from "@/app/components/feedback/CustomLoader";
import { resolveDisplayRole } from "@/app/lib/userRole";

interface GuestOnlyGuardProps {
  children: ReactNode;
}

const GuestOnlyGuard = ({ children }: GuestOnlyGuardProps) => {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    const resolvedRole = resolveDisplayRole(user);
    if (resolvedRole === "ADMIN" || resolvedRole === "SUPERADMIN") {
      router.replace("/dashboard");
      return;
    }
    router.replace("/");
  }, [
    isAuthenticated,
    isLoading,
    router,
    user?.role,
    user?.effectiveRole,
    user?.dealerStatus,
    user?.isDealer,
  ]);

  if (isLoading) {
    return <CustomLoader />;
  }

  if (isAuthenticated) return null;

  return <>{children}</>;
};

export default GuestOnlyGuard;
