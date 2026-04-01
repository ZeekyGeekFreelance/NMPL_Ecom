"use client";

import { resolveDisplayRole } from "@/app/lib/userRole";

const FIRST_LOGIN_STORAGE_KEY = "auth.firstLogin";

export type FirstLoginPortal = "USER_PORTAL" | "DEALER_PORTAL";

export type FirstLoginState = {
  email: string;
  currentPassword: string;
  portal: FirstLoginPortal;
  nextPath: string | null;
};

type RedirectUser = {
  role?: string | null;
  effectiveRole?: string | null;
  dealerStatus?: string | null;
  isDealer?: boolean | null;
};

const normalizeNextPath = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.startsWith("/") ? trimmed : null;
};

const isPortal = (value: unknown): value is FirstLoginPortal =>
  value === "USER_PORTAL" || value === "DEALER_PORTAL";

export const storeFirstLoginState = (state: FirstLoginState): void => {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(
    FIRST_LOGIN_STORAGE_KEY,
    JSON.stringify({
      email: String(state.email || "").trim(),
      currentPassword: String(state.currentPassword || ""),
      portal: state.portal,
      nextPath: normalizeNextPath(state.nextPath),
    })
  );
};

const readLegacyDealerState = (): FirstLoginState | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const email = sessionStorage.getItem("dealer_temp_email");
  const currentPassword = sessionStorage.getItem("dealer_temp_password");

  if (!email || !currentPassword) {
    return null;
  }

  return {
    email,
    currentPassword,
    portal: "DEALER_PORTAL",
    nextPath: null,
  };
};

export const readFirstLoginState = (): FirstLoginState | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = sessionStorage.getItem(FIRST_LOGIN_STORAGE_KEY);
  if (!rawValue) {
    return readLegacyDealerState();
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<FirstLoginState>;
    if (
      typeof parsed.email !== "string" ||
      typeof parsed.currentPassword !== "string" ||
      !isPortal(parsed.portal)
    ) {
      return readLegacyDealerState();
    }

    return {
      email: parsed.email,
      currentPassword: parsed.currentPassword,
      portal: parsed.portal,
      nextPath: normalizeNextPath(parsed.nextPath),
    };
  } catch {
    return readLegacyDealerState();
  }
};

export const clearFirstLoginState = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.removeItem(FIRST_LOGIN_STORAGE_KEY);
  sessionStorage.removeItem("dealer_temp_email");
  sessionStorage.removeItem("dealer_temp_password");
};

export const resolvePostPasswordChangeDestination = (
  user?: RedirectUser | null,
  nextPath?: string | null
): string => {
  const resolvedRole = resolveDisplayRole(user);
  if (resolvedRole === "ADMIN" || resolvedRole === "SUPERADMIN") {
    return "/dashboard";
  }

  return normalizeNextPath(nextPath) || "/";
};
