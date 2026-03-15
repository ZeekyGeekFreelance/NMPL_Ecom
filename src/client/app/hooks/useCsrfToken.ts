"use client";

import { useEffect } from "react";
import axiosInstance from "@/app/utils/axiosInstance";

/**
 * Hook to ensure CSRF token is fetched and stored in cookies
 * Should be called once at app initialization
 */
export const useCsrfToken = () => {
  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        // Hit the lightweight CSRF bootstrap endpoint to set the cookie.
        await axiosInstance.get("/csrf");
      } catch {
        // Silently fail - token will be generated on next safe API request
        console.debug("CSRF token prefetch failed; token will be set by the next safe API request.");
      }
    };

    fetchCsrfToken();
  }, []);
};
