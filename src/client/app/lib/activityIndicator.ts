"use client";

export const GLOBAL_ACTIVITY_START_EVENT = "nmpl:activity:start";
export const GLOBAL_ACTIVITY_END_EVENT = "nmpl:activity:end";

type ActivityEventDetail = {
  token: string;
};

let activitySequence = 0;

const isBrowser = () => typeof window !== "undefined";

const buildToken = () => {
  activitySequence += 1;
  return `activity-${Date.now()}-${activitySequence}`;
};

export const beginGlobalActivity = (): string | null => {
  if (!isBrowser()) {
    return null;
  }

  const token = buildToken();
  window.dispatchEvent(
    new CustomEvent<ActivityEventDetail>(GLOBAL_ACTIVITY_START_EVENT, {
      detail: { token },
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
