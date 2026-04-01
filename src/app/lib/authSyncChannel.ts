export type AuthSyncEventType =
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "SESSION_REFRESHED";

export type AuthSyncEvent = {
  type: AuthSyncEventType;
  at: number;
  source: string;
};

const CHANNEL_NAME = "wpdms-auth-sync";
const STORAGE_KEY = "wpdms-auth-sync-event";

const isBrowser = typeof window !== "undefined";
const TAB_ID = isBrowser
  ? `tab-${Math.random().toString(36).slice(2)}-${Date.now()}`
  : "server";

let channel: BroadcastChannel | null = null;

const getChannel = () => {
  if (!isBrowser || typeof BroadcastChannel === "undefined") {
    return null;
  }

  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }

  return channel;
};

const parseEventPayload = (value: unknown): AuthSyncEvent | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Partial<AuthSyncEvent>;
  if (
    !payload.type ||
    typeof payload.type !== "string" ||
    typeof payload.at !== "number" ||
    typeof payload.source !== "string"
  ) {
    return null;
  }

  return payload as AuthSyncEvent;
};

export const emitAuthSyncEvent = (type: AuthSyncEventType) => {
  if (!isBrowser) {
    return;
  }

  const payload: AuthSyncEvent = {
    type,
    at: Date.now(),
    source: TAB_ID,
  };

  try {
    getChannel()?.postMessage(payload);
  } catch {
    // Best effort: continue with storage fallback.
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage may be disabled; silently ignore.
  }
};

export const subscribeAuthSyncEvents = (
  callback: (event: AuthSyncEvent) => void
) => {
  if (!isBrowser) {
    return () => {};
  }

  const seenEventKeys = new Set<string>();

  const handleEvent = (event: AuthSyncEvent | null) => {
    if (!event || event.source === TAB_ID) {
      return;
    }

    const eventKey = `${event.source}:${event.at}:${event.type}`;
    if (seenEventKeys.has(eventKey)) {
      return;
    }

    seenEventKeys.add(eventKey);
    callback(event);
  };

  const channelRef = getChannel();
  const channelListener = (event: MessageEvent<AuthSyncEvent>) => {
    handleEvent(parseEventPayload(event.data));
  };

  if (channelRef) {
    channelRef.addEventListener("message", channelListener);
  }

  const storageListener = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) {
      return;
    }

    try {
      handleEvent(parseEventPayload(JSON.parse(event.newValue)));
    } catch {
      // Ignore malformed payloads.
    }
  };

  window.addEventListener("storage", storageListener);

  return () => {
    if (channelRef) {
      channelRef.removeEventListener("message", channelListener);
    }
    window.removeEventListener("storage", storageListener);
  };
};
