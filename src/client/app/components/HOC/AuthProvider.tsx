import { useLazyGetMeQuery } from "@/app/store/apis/UserApi";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import { logout, setUser } from "@/app/store/slices/AuthSlice";
import { subscribeAuthSyncEvents } from "@/app/lib/authSyncChannel";
import { useCallback, useEffect, useRef } from "react";

const isDevelopment = process.env.NODE_ENV !== "production";
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
  role: string;
  avatar: string | null;
  isDealer?: boolean;
  dealerStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
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
    currentUser.name !== nextUser.name ||
    currentUser.role !== nextUser.role ||
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
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.user);
  const [triggerGetMe] = useLazyGetMeQuery();
  const isRevalidatingRef = useRef(false);
  const lastRevalidatedAtRef = useRef(0);
  const currentUserRef = useRef(currentUser);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const revalidateAuth = useCallback(
    async (reason: string) => {
      const now = Date.now();

      if (isRevalidatingRef.current) {
        return;
      }

      if (now - lastRevalidatedAtRef.current < MIN_REVALIDATE_INTERVAL_MS) {
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

        dispatch(logout());
      } catch (error) {
        if (isUnauthorizedError(error)) {
          dispatch(logout());
          return;
        }

        if (currentUserRef.current === undefined) {
          dispatch(logout());
        }

        debugLog(`[AuthProvider] Auth revalidation failed (${reason})`, error);
      } finally {
        isRevalidatingRef.current = false;
      }
    },
    [dispatch, triggerGetMe]
  );

  useEffect(() => {
    void revalidateAuth("mount");

    const unsubscribe = subscribeAuthSyncEvents((event) => {
      void revalidateAuth(`auth-sync:${event.type}`);
    });

    const handleFocus = () => {
      void revalidateAuth("window-focus");
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void revalidateAuth("visibility-visible");
      }
    };

    const handleOnline = () => {
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
  }, [revalidateAuth]);

  return <>{children}</>;
}
