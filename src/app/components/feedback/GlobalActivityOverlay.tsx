"use client";

import { useEffect, useRef, useState } from "react";
import {
  GLOBAL_ACTIVITY_END_EVENT,
  GLOBAL_ACTIVITY_START_EVENT,
} from "@/app/lib/activityIndicator";
import SpokeSpinner from "@/app/components/feedback/SpokeSpinner";

const SHOW_DELAY_MS = 120;
const MIN_VISIBLE_MS = 260;

const GlobalActivityOverlay = () => {
  const activeTokensRef = useRef<Set<string>>(new Set());
  const [isVisible, setIsVisible] = useState(false);
  const isVisibleRef = useRef(false);
  const visibleSinceRef = useRef<number | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const clearTimers = () => {
      if (showTimerRef.current !== null) {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    const syncVisibility = () => {
      const hasActiveNavigation = activeTokensRef.current.size > 0;
      const isCurrentlyVisible = isVisibleRef.current;

      if (hasActiveNavigation) {
        if (hideTimerRef.current !== null) {
          window.clearTimeout(hideTimerRef.current);
          hideTimerRef.current = null;
        }

        if (!isCurrentlyVisible && showTimerRef.current === null) {
          showTimerRef.current = window.setTimeout(() => {
            showTimerRef.current = null;
            visibleSinceRef.current = Date.now();
            isVisibleRef.current = true;
            setIsVisible(true);
          }, SHOW_DELAY_MS);
        }

        return;
      }

      if (showTimerRef.current !== null) {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }

      if (!isCurrentlyVisible) {
        return;
      }

      const visibleSince = visibleSinceRef.current;
      const elapsed = visibleSince ? Date.now() - visibleSince : MIN_VISIBLE_MS;
      const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

      hideTimerRef.current = window.setTimeout(() => {
        hideTimerRef.current = null;
        visibleSinceRef.current = null;
        isVisibleRef.current = false;
        setIsVisible(false);
      }, remaining);
    };

    const handleStart = (event: Event) => {
      const typedEvent = event as CustomEvent<{
        token?: string;
        source?: "generic" | "navigation";
      }>;
      const token = typedEvent.detail?.token;
      if (!token || typedEvent.detail?.source !== "navigation") {
        return;
      }

      activeTokensRef.current.add(token);
      syncVisibility();
    };

    const handleEnd = (event: Event) => {
      const typedEvent = event as CustomEvent<{ token?: string }>;
      const token = typedEvent.detail?.token;
      if (!token) {
        return;
      }

      activeTokensRef.current.delete(token);
      syncVisibility();
    };

    window.addEventListener(GLOBAL_ACTIVITY_START_EVENT, handleStart);
    window.addEventListener(GLOBAL_ACTIVITY_END_EVENT, handleEnd);

    return () => {
      clearTimers();
      window.removeEventListener(GLOBAL_ACTIVITY_START_EVENT, handleStart);
      window.removeEventListener(GLOBAL_ACTIVITY_END_EVENT, handleEnd);
      activeTokensRef.current.clear();
      isVisibleRef.current = false;
      visibleSinceRef.current = null;
    };
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[10001] flex items-center justify-center bg-slate-950/8 px-4 backdrop-blur-[2px]"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="inline-flex items-center justify-center rounded-[28px] border border-white/70 bg-white/94 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
        <SpokeSpinner size={60} />
      </div>
    </div>
  );
};

export default GlobalActivityOverlay;
