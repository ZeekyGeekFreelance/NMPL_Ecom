"use client";
import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import NProgress from "nprogress";
import "nprogress/nprogress.css";

NProgress.configure({ showSpinner: false, minimum: 0.2 });

function Inner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    NProgress.done();
    return () => { NProgress.start(); };
  }, [pathname, searchParams]);

  return null;
}

export function TopLoadingBar() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
