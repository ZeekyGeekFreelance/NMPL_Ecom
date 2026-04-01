"use client";

export type AuthIntentActionType = "add_to_cart" | "buy_now";

export type PendingAuthIntent = {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  actionType: AuthIntentActionType;
  returnTo?: string;
  createdAt: number;
};

const AUTH_INTENT_STORAGE_KEY = "wpdms.pending-auth-intent";

const isClient = () => typeof window !== "undefined";

const toSafePositiveInteger = (value: unknown, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const parseStoredIntent = (raw: string | null): PendingAuthIntent | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PendingAuthIntent>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.productId ||
      !parsed.actionType
    ) {
      return null;
    }

    if (
      parsed.actionType !== "add_to_cart" &&
      parsed.actionType !== "buy_now"
    ) {
      return null;
    }

    return {
      id:
        typeof parsed.id === "string" && parsed.id.trim().length > 0
          ? parsed.id
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      productId: String(parsed.productId),
      variantId:
        typeof parsed.variantId === "string" && parsed.variantId.trim().length > 0
          ? parsed.variantId
          : undefined,
      quantity: toSafePositiveInteger(parsed.quantity, 1),
      actionType: parsed.actionType,
      returnTo:
        typeof parsed.returnTo === "string" && parsed.returnTo.trim().length > 0
          ? parsed.returnTo
          : undefined,
      createdAt:
        typeof parsed.createdAt === "number" && Number.isFinite(parsed.createdAt)
          ? parsed.createdAt
          : Date.now(),
    };
  } catch {
    return null;
  }
};

export const getPendingAuthIntent = (): PendingAuthIntent | null => {
  if (!isClient()) {
    return null;
  }

  return parseStoredIntent(
    window.localStorage.getItem(AUTH_INTENT_STORAGE_KEY)
  );
};

export const setPendingAuthIntent = (
  intent: Omit<PendingAuthIntent, "id" | "createdAt">
) => {
  if (!isClient()) {
    return;
  }

  const normalized: PendingAuthIntent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: Date.now(),
    productId: String(intent.productId || ""),
    variantId:
      typeof intent.variantId === "string" && intent.variantId.trim().length > 0
        ? intent.variantId
        : undefined,
    quantity: toSafePositiveInteger(intent.quantity, 1),
    actionType: intent.actionType,
    returnTo:
      typeof intent.returnTo === "string" && intent.returnTo.trim().length > 0
        ? intent.returnTo
        : undefined,
  };

  if (!normalized.productId) {
    return;
  }

  window.localStorage.setItem(
    AUTH_INTENT_STORAGE_KEY,
    JSON.stringify(normalized)
  );
};

export const clearPendingAuthIntent = () => {
  if (!isClient()) {
    return;
  }

  window.localStorage.removeItem(AUTH_INTENT_STORAGE_KEY);
};
