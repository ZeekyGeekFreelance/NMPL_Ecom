"use client";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { beginNavigationActivity, endNavigationActivity } from "@/app/lib/activityIndicator";

const TopLoadingBar: React.FC = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    endNavigationActivity();
  }, [routeKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        anchor.getAttribute("rel") === "external"
      ) {
        return;
      }

      const nextUrl = new URL(anchor.href, window.location.href);
      if (nextUrl.origin !== window.location.origin) {
        return;
      }

      const currentUrl = new URL(window.location.href);
      if (
        nextUrl.pathname === currentUrl.pathname &&
        nextUrl.search === currentUrl.search
      ) {
        return;
      }

      beginNavigationActivity();
    };

    window.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("click", handleDocumentClick, true);
    };
  }, []);

  return null;
};

export default TopLoadingBar;
