"use client";
import { useCreateInteractionMutation } from "@/app/store/apis/AnalyticsApi";
import { useCallback, useRef } from "react";
import { useAppSelector } from "../state/useRedux";

interface TrackInteractionOptions {
  debounceMs?: number;
}

const sentViewInteractions = new Set<string>();

const useTrackInteraction = ({
  debounceMs = 500,
}: TrackInteractionOptions = {}) => {
  const { user } = useAppSelector((state) => state.auth);

  const [createInteraction] = useCreateInteractionMutation();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const trackInteraction = useCallback(
    async (productId: string | undefined, type: "view" | "click" | "other") => {
      if (!user?.id || !productId) return;

      const interactionKey = `${user.id}:${productId}:${type}`;
      if (type === "view" && sentViewInteractions.has(interactionKey)) {
        return;
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(async () => {
        try {
          if (type === "view") {
            sentViewInteractions.add(interactionKey);
          }

          await createInteraction({
            userId: user.id,
            productId,
            type,
          }).unwrap();
        } catch (error) {
          if (type === "view") {
            sentViewInteractions.delete(interactionKey);
          }
          console.error("Failed to track interaction:", error);
        }
      }, debounceMs);
    },
    [user?.id, createInteraction, debounceMs]
  );

  return { trackInteraction, isTracking: !!timeoutRef.current };
};

export default useTrackInteraction;
