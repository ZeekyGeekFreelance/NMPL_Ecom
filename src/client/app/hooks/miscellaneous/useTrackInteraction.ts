"use client";
import { API_BASE_URL } from "@/app/lib/constants/config";
import { useCallback, useEffect } from "react";
import { useAppSelector } from "../state/useRedux";

interface TrackInteractionOptions {
  debounceMs?: number;
  maxBatchSize?: number;
}

const sentViewInteractions = new Set<string>();
type InteractionType = "view" | "click" | "other";
type InteractionEvent = {
  productId: string;
  type: InteractionType;
};

const interactionQueue: InteractionEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushing = false;
let lifecycleBound = false;

const createMutationKey = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `track-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const queueBatchForRetry = (batch: InteractionEvent[]) => {
  if (!batch.length) {
    return;
  }

  interactionQueue.unshift(...batch);
};

const sendInteractionBatch = async (
  batch: InteractionEvent[]
): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/analytics/interactions/bulk`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "x-idempotency-key": createMutationKey(),
    },
    body: JSON.stringify({ events: batch }),
  });

  if (!response.ok) {
    throw new Error(`Interaction batch request failed with status ${response.status}`);
  }
};

const dequeueNextBatch = (maxBatchSize: number): InteractionEvent[] => {
  const safeBatchSize = Math.max(1, maxBatchSize);
  return interactionQueue.splice(0, safeBatchSize);
};

const flushInteractions = async (maxBatchSize: number): Promise<void> => {
  if (isFlushing || interactionQueue.length === 0) {
    return;
  }

  isFlushing = true;

  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const batch = dequeueNextBatch(maxBatchSize);
  try {
    await sendInteractionBatch(batch);
  } catch (error) {
    queueBatchForRetry(batch);
    console.error("Failed to track interaction batch:", error);
  } finally {
    isFlushing = false;
    if (interactionQueue.length > 0) {
      flushTimer = setTimeout(() => {
        void flushInteractions(maxBatchSize);
      }, 160);
    }
  }
};

const scheduleFlush = (debounceMs: number, maxBatchSize: number) => {
  if (flushTimer) {
    clearTimeout(flushTimer);
  }

  flushTimer = setTimeout(() => {
    void flushInteractions(maxBatchSize);
  }, Math.max(0, debounceMs));
};

const bindLifecycleFlushHandlers = (maxBatchSize: number) => {
  if (lifecycleBound || typeof window === "undefined") {
    return;
  }

  lifecycleBound = true;

  const flushNow = () => {
    void flushInteractions(maxBatchSize);
  };

  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushNow();
    }
  });
  window.addEventListener("beforeunload", flushNow);
};

const useTrackInteraction = ({
  debounceMs = 500,
  maxBatchSize = 20,
}: TrackInteractionOptions = {}) => {
  const { user } = useAppSelector((state) => state.auth);
  useEffect(() => {
    bindLifecycleFlushHandlers(maxBatchSize);
  }, [maxBatchSize]);

  const trackInteraction = useCallback(
    async (productId: string | undefined, type: InteractionType) => {
      if (!user?.id || !productId) return;

      const interactionKey = `${user.id}:${productId}:${type}`;
      if (type === "view" && sentViewInteractions.has(interactionKey)) {
        return;
      }

      if (type === "view") {
        sentViewInteractions.add(interactionKey);
      }

      interactionQueue.push({
        productId,
        type,
      });

      if (interactionQueue.length >= maxBatchSize) {
        void flushInteractions(maxBatchSize);
        return;
      }

      scheduleFlush(debounceMs, maxBatchSize);
    },
    [user?.id, debounceMs, maxBatchSize]
  );

  return {
    trackInteraction,
    isTracking: isFlushing || interactionQueue.length > 0,
  };
};

export default useTrackInteraction;
