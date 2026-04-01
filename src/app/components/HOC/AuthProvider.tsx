"use client";

import { useLazyGetMeQuery } from "@/app/store/apis/UserApi";
import { useAddToCartMutation } from "@/app/store/apis/CartApi";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import { logout, setUser } from "@/app/store/slices/AuthSlice";
import { apiSlice } from "@/app/store/slices/ApiSlice";
import { subscribeAuthSyncEvents } from "@/app/lib/authSyncChannel";
import { clearPendingAuthIntent, getPendingAuthIntent } from "@/app/lib/authIntent";
import { isCustomerDisplayRole, resolveDisplayRole } from "@/app/lib/userRole";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";
import useToast from "@/app/hooks/ui/useToast";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { runtimeEnv } from "@/app/lib/runtimeEnv";

const isDevelopment = runtimeEnv.isDevelopment;
const MIN_REVALIDATE_INTERVAL_MS = 800;

const debugLog = (...args: unknown[]) => {
  if (isDevelopment) {
    console.log(...args);
  }
};

const getErrorStatus = (error: unknown): number | string | undefined => {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const typedError = error as { status?: number | string; originalStatus?: number };
  return typedError.status ?? typedError.originalStatus;
};

const isUnauthorizedError = (error: unknown) => getErrorStatus(error) === 401;

type AuthUser = {
  id: string;
  accountReference?: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  effectiveRole?: "USER" | "DEALER" | "ADMIN" | "SUPERADMIN";
  avatar: string | null;
  isDealer?: boolean;
  dealerStatus?:
    | "PENDING"
    | "APPROVED"
    | "LEGACY"
    | "REJECTED"
    | "SUSPENDED"
    | null;
  dealerBusinessName?: string | null;
  dealerContactPhone?: string | null;
};

const resolveUserFromGetMeResponse = (payload: unknown): AuthUser | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const typedPayload = payload as { user?: unknown; id?: unknown };
  if (typedPayload.user && typeof typedPayload.user === "object") {
    const nestedUser = typedPayload.user as { id?: unknown };
    if (typeof nestedUser.id === "string") {
      return typedPayload.user as AuthUser;
    }
  }

  if (typeof typedPayload.id === "string") {
    return typedPayload as AuthUser;
  }

  return null;
};

const shouldUpdateUserState = (
  currentUser: AuthUser | null | undefined,
  nextUser: AuthUser
) => {
  if (!currentUser) {
    return true;
  }

  return (
    currentUser.id !== nextUser.id ||
    currentUser.accountReference !== nextUser.accountReference ||
    currentUser.email !== nextUser.email ||
    currentUser.phone !== nextUser.phone ||
    currentUser.name !== nextUser.name ||
    currentUser.role !== nextUser.role ||
    currentUser.effectiveRole !== nextUser.effectiveRole ||
    currentUser.avatar !== nextUser.avatar ||
    currentUser.isDealer !== nextUser.isDealer ||
    currentUser.dealerStatus !== nextUser.dealerStatus ||
    currentUser.dealerBusinessName !== nextUser.dealerBusinessName ||
    currentUser.dealerContactPhone !== nextUser.dealerContactPhone
  );
};

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { showToast } = useToast();
  const { user: currentUser, isAuthChecking } = useAppSelector(
    (state) => state.auth
  );
  const [triggerGetMe] = useLazyGetMeQuery();
  const [addToCart] = useAddToCartMutation();
  const isRevalidatingRef = useRef(false);
  const lastRevalidatedAtRef = useRef(0);
  const currentUserRef = useRef(currentUser);
  const isHandlingAuthIntentRef = useRef(false);
  const lastHandledAuthIntentIdRef = useRef<string | null>(null);

  const applyLocalSignedOutState = useCallback(() => {
    dispatch(apiSlice.util.resetApiState());
    dispatch(logout());
    // Only wipe a pending add-to-cart intent when a user was actually logged in
    // (explicit sign-out or session expiry). During the initial bootstrap auth
    // check the user was never authenticated, so currentUserRef.current is
    // undefined — clearing here would destroy an intent the guest just set
    // seconds before being redirected to the sign-in page.
    if (currentUserRef.current) {
      clearPendingAuthIntent();
    }
  }, [dispatch]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser?.id) {
      return;
    }

    if (isHandlingAuthIntentRef.current) {
      return;
    }

    const pendingIntent = getPendingAuthIntent();
    if (!pendingIntent) {
      return;
    }

    if (lastHandledAuthIntentIdRef.current === pendingIntent.id) {
      return;
    }

    const canUseCart = isCustomerDisplayRole(resolveDisplayRole(currentUser));
    if (!canUseCart) {
      clearPendingAuthIntent();
      lastHandledAuthIntentIdRef.current = pendingIntent.id;
      showToast(
        "Pending cart action was cleared because this account cannot use cart.",
        "error"
      );
      return;
    }

    const variantId = pendingIntent.variantId || pendingIntent.productId;
    if (!variantId) {
      clearPendingAuthIntent();
      lastHandledAuthIntentIdRef.current = pendingIntent.id;
      return;
    }

    isHandlingAuthIntentRef.current = true;
    lastHandledAuthIntentIdRef.current = pendingIntent.id;

    (async () => {
      try {
        await addToCart({
          variantId,
          quantity: pendingIntent.quantity,
        }).unwrap();

        clearPendingAuthIntent();

        if (pendingIntent.actionType === "buy_now") {
          showToast("Item added to cart. Continue to checkout.", "success");
          router.push("/cart");
          return;
        }

        showToast("Item added to cart.", "success");
        if (pendingIntent.returnTo && pathname !== pendingIntent.returnTo) {
          router.push(pendingIntent.returnTo);
        }
      } catch (error) {
        showToast(
          getApiErrorMessage(
            error,
            "Unable to restore your pending cart action. Please retry."
          ),
          "error"
        );
      } finally {
        isHandlingAuthIntentRef.current = false;
      }
    })();
  }, [addToCart, currentUser, pathname, router, showToast]);

  const revalidateAuth = useCallback(
    async (reason: string, options?: { force?: boolean }) => {
      const now = Date.now();

      if (isRevalidatingRef.current) {
        return;
      }

      if (
        !options?.force &&
        now - lastRevalidatedAtRef.current < MIN_REVALIDATE_INTERVAL_MS
      ) {
        return;
      }

      isRevalidatingRef.current = true;
      lastRevalidatedAtRef.current = now;

      try {
        const response = await triggerGetMe(undefined, false).unwrap();
        const user = resolveUserFromGetMeResponse(response);

        if (user) {
          if (shouldUpdateUserState(currentUserRef.current as AuthUser | null | undefined, user)) {
            dispatch(setUser({ user }));
          }
          return;
        }

        applyLocalSignedOutState();
      } catch (error) {
        if (isUnauthorizedError(error)) {
          applyLocalSignedOutState();
          return;
        }

        // For non-401 errors (network issues, server down, etc.) during bootstrap,
        // set auth to null only if we have no existing user — don't log out a
        // known-good session just because the server is temporarily unreachable.
        if (currentUserRef.current === undefined) {
          // Unknown bootstrap state — mark as not authenticated but don't
          // emit SIGNED_OUT so other tabs aren't affected.
          dispatch(logout());
        }
        debugLog(`[AuthProvider] Auth revalidation failed (${reason})`, error);
      } finally {
        isRevalidatingRef.current = false;
      }
    },
    [applyLocalSignedOutState, dispatch, triggerGetMe]
  );

  useEffect(() => {
    if (!isAuthChecking) {
      return;
    }
    if (currentUserRef.current !== undefined) {
      return;
    }
    void revalidateAuth("bootstrap", { force: true });
  }, [isAuthChecking, revalidateAuth]);

  useEffect(() => {
    const unsubscribe = subscribeAuthSyncEvents((event) => {
      if (event.type === "SIGNED_OUT") {
        applyLocalSignedOutState();
        return;
      }

      if (event.type === "SIGNED_IN" || event.type === "SESSION_REFRESHED") {
        void revalidateAuth(`auth-sync:${event.type}`, { force: true });
      }
    });

    const shouldRevalidateFromLifecycleEvent = () => {
      if (isAuthChecking) {
        return false;
      }

      return !!currentUserRef.current;
    };

    const handleFocus = () => {
      if (!shouldRevalidateFromLifecycleEvent()) {
        return;
      }
      void revalidateAuth("window-focus");
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (!shouldRevalidateFromLifecycleEvent()) {
          return;
        }
        void revalidateAuth("visibility-visible");
      }
    };

    const handleOnline = () => {
      if (!shouldRevalidateFromLifecycleEvent()) {
        return;
      }
      void revalidateAuth("network-online");
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      unsubscribe();
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, [applyLocalSignedOutState, dispatch, isAuthChecking, revalidateAuth]);

  return <>{children}</>;
}
