"use client";
import { useEffect } from "react";
import NProgress from "nprogress";
import { usePathname } from "next/navigation";

const TopLoadingBar: React.FC = () => {
  const pathname = usePathname();

  useEffect(() => {
    NProgress.configure({ showSpinner: false, speed: 400, minimum: 0.2 });

    NProgress.start();

    const timer = setTimeout(() => {
      NProgress.done();
    }, 400); // Match NProgress speed

    return () => {
      clearTimeout(timer);
      NProgress.done();
    };
  }, [pathname]);

  return null;
};

export default TopLoadingBar;
