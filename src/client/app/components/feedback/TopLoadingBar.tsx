"use client";
import { useEffect, useRef } from "react";
import NProgress from "nprogress";
import { usePathname } from "next/navigation";
import {
  GLOBAL_ACTIVITY_END_EVENT,
  GLOBAL_ACTIVITY_START_EVENT,
} from "@/app/lib/activityIndicator";

const TopLoadingBar: React.FC = () => {
  const pathname = usePathname();
  const activeTokensRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    NProgress.configure({ showSpinner: false, speed: 400, minimum: 0.2 });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const startActivity = (token: string) => {
      const tokens = activeTokensRef.current;
      const wasIdle = tokens.size === 0;
      tokens.add(token);
      if (wasIdle) {
        NProgress.start();
      }
    };

    const finishActivity = (token: string) => {
      const tokens = activeTokensRef.current;
      tokens.delete(token);
      if (tokens.size === 0) {
        NProgress.done();
      }
    };

    const handleStart = (event: Event) => {
      const typedEvent = event as CustomEvent<{ token?: string }>;
      const token = typedEvent.detail?.token;
      if (!token) {
        return;
      }
      startActivity(token);
    };

    const handleEnd = (event: Event) => {
      const typedEvent = event as CustomEvent<{ token?: string }>;
      const token = typedEvent.detail?.token;
      if (!token) {
        return;
      }
      finishActivity(token);
    };

    window.addEventListener(GLOBAL_ACTIVITY_START_EVENT, handleStart);
    window.addEventListener(GLOBAL_ACTIVITY_END_EVENT, handleEnd);

    return () => {
      window.removeEventListener(GLOBAL_ACTIVITY_START_EVENT, handleStart);
      window.removeEventListener(GLOBAL_ACTIVITY_END_EVENT, handleEnd);
      activeTokensRef.current.clear();
      NProgress.done();
    };
  }, []);

  useEffect(() => {
    const routeToken = `route-${pathname}-${Date.now()}`;
    activeTokensRef.current.add(routeToken);
    NProgress.start();

    const timer = setTimeout(() => {
      activeTokensRef.current.delete(routeToken);
      if (activeTokensRef.current.size === 0) {
        NProgress.done();
      }
    }, 400); // Match NProgress speed

    return () => {
      clearTimeout(timer);
      activeTokensRef.current.delete(routeToken);
      if (activeTokensRef.current.size === 0) {
        NProgress.done();
      }
    };
  }, [pathname]);

  return null;
};

export default TopLoadingBar;
