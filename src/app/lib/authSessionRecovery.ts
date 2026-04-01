"use client";

const STORAGE_KEY = "nmpl-auth-flash";

export const storeAuthFlashMessage = (message: string): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(STORAGE_KEY, message);
  } catch {
    // Best effort only.
  }
};

export const consumeAuthFlashMessage = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const message = window.sessionStorage.getItem(STORAGE_KEY);
    if (message) {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
    return message;
  } catch {
    return null;
  }
};
