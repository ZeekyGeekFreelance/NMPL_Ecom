"use client";

import { useRouter, usePathname } from "next/navigation";
import CustomLoader from "../feedback/CustomLoader";
import { useAuth } from "@/app/hooks/useAuth";
import { useEffect, useMemo, useState } from "react";

type AppRole = "USER" | "ADMIN" | "SUPERADMIN";

type WithAuthOptions = {
  allowedRoles?: AppRole[];
  redirectTo?: string;
  unauthorizedRedirectTo?: string;
};

const getDefaultAllowedRoles = (
  pathname?: string | null
): AppRole[] | undefined => {
  if (typeof pathname !== "string") {
    return undefined;
  }

  if (pathname.startsWith("/dashboard")) {
    return ["ADMIN", "SUPERADMIN"];
  }

  return undefined;
};

export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options?: WithAuthOptions
) {
  return function AuthWrapper(props: P) {
    const { isAuthenticated, isLoading, user } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isRedirecting, setIsRedirecting] = useState(false);

    const allowedRoles = useMemo(
      () => options?.allowedRoles || getDefaultAllowedRoles(pathname),
      [options?.allowedRoles, pathname]
    );

    useEffect(() => {
      if (isLoading) {
        return;
      }

      if (!isAuthenticated) {
        setIsRedirecting(true);
        const configuredRedirect = options?.redirectTo || "/sign-in";
        if (configuredRedirect === "/sign-in" && typeof window !== "undefined") {
          const nextPath = `${window.location.pathname}${window.location.search}`;
          router.replace(`/sign-in?next=${encodeURIComponent(nextPath)}`);
        } else {
          router.replace(configuredRedirect);
        }
        return;
      }

      if (allowedRoles?.length && user?.role && !allowedRoles.includes(user.role as AppRole)) {
        setIsRedirecting(true);
        const fallbackPath =
          options?.unauthorizedRedirectTo ||
          (user.role === "ADMIN" || user.role === "SUPERADMIN"
            ? "/dashboard"
            : "/");
        router.replace(fallbackPath);
        return;
      }

      setIsRedirecting(false);
    }, [
      allowedRoles,
      isAuthenticated,
      isLoading,
      options?.redirectTo,
      options?.unauthorizedRedirectTo,
      router,
      user?.role,
    ]);

    if (isLoading || isRedirecting) {
      return <CustomLoader />;
    }

    if (!isAuthenticated) {
      return null;
    }

    if (allowedRoles?.length && user?.role && !allowedRoles.includes(user.role as AppRole)) {
      return null;
    }

    return <Component {...props} />;
  };
}
