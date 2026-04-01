"use client";

export const GLOBAL_ACTIVITY_START_EVENT = "nmpl:activity:start";
export const GLOBAL_ACTIVITY_END_EVENT = "nmpl:activity:end";

type ActivityEventDetail = {
  token: string;
  source?: "generic" | "navigation";
};

let activitySequence = 0;
let navigationActivityToken: string | null = null;
let navigationActivityTimeoutId: number | null = null;

const isBrowser = () => typeof window !== "undefined";

const buildToken = () => {
  activitySequence += 1;
  return `activity-${Date.now()}-${activitySequence}`;
};

const clearNavigationActivityTimeout = () => {
  if (!isBrowser() || navigationActivityTimeoutId === null) {
    return;
  }

  window.clearTimeout(navigationActivityTimeoutId);
  navigationActivityTimeoutId = null;
};

export const beginGlobalActivity = (
  source: ActivityEventDetail["source"] = "generic"
): string | null => {
  if (!isBrowser()) {
    return null;
  }

  const token = buildToken();
  window.dispatchEvent(
    new CustomEvent<ActivityEventDetail>(GLOBAL_ACTIVITY_START_EVENT, {
      detail: { token, source },
    })
  );
  return token;
};

export const endGlobalActivity = (token: string | null | undefined): void => {
  if (!isBrowser() || !token) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ActivityEventDetail>(GLOBAL_ACTIVITY_END_EVENT, {
      detail: { token },
    })
  );
};

export const beginNavigationActivity = (): string | null => {
  if (!isBrowser()) {
    return null;
  }

  if (navigationActivityToken) {
    return navigationActivityToken;
  }

  const token = beginGlobalActivity("navigation");
  navigationActivityToken = token;
  clearNavigationActivityTimeout();

  if (token) {
    navigationActivityTimeoutId = window.setTimeout(() => {
      endNavigationActivity();
    }, 15_000);
  }

  return token;
};

export const endNavigationActivity = (): void => {
  if (!isBrowser() || !navigationActivityToken) {
    return;
  }

  const token = navigationActivityToken;
  navigationActivityToken = null;
  clearNavigationActivityTimeout();
  endGlobalActivity(token);
};

export const runWithGlobalActivity = async <T>(
  action: () => Promise<T>
): Promise<T> => {
  const token = beginGlobalActivity();

  try {
    return await action();
  } finally {
    endGlobalActivity(token);
  }
};
