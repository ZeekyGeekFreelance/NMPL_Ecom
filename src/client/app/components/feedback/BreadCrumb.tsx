"use client";
import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const TITLE_MAP: Record<string, string> = {
  shop: "Shop",
  product: "Products",
  dashboard: "Dashboard",
  transactions: "Transactions",
  inventory: "Inventory",
  analytics: "Analytics",
  reports: "Reports",
  gst: "GST",
  users: "Users",
  dealers: "Dealers",
  products: "Products",
  categories: "Categories",
  profile: "Profile",
  cart: "Cart",
  orders: "Orders",
  "sign-in": "Sign In",
  "sign-up": "Sign Up",
};

const ROUTE_OVERRIDE_MAP: Record<string, string> = {
  product: "/shop",
};

const UUID_LIKE_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const formatSegmentLabel = (segment: string) => {
  const decoded = decodeURIComponent(segment).trim();
  const mapped = TITLE_MAP[decoded.toLowerCase()];

  if (mapped) {
    return mapped;
  }

  return decoded
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const BreadCrumb: React.FC = () => {
  const pathname = usePathname();
  const pathSegments = pathname.split("/").filter(Boolean);

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center text-xs sm:text-sm text-gray-500 space-x-1 sm:space-x-2">
        <li>
          <Link
            href="/"
            className="hover:text-indigo-600 font-medium transition"
          >
            Home
          </Link>
        </li>

        {pathSegments.map((segment, index) => {
          const defaultHref = "/" + pathSegments.slice(0, index + 1).join("/");
          const href = ROUTE_OVERRIDE_MAP[segment] || defaultHref;
          const isLast = index === pathSegments.length - 1;
          const label = formatSegmentLabel(segment);
          const isDynamicUuid = UUID_LIKE_SEGMENT.test(segment);
          const shouldLink = !isLast && !isDynamicUuid;

          return (
            <React.Fragment key={href}>
              <span className="text-gray-400">/</span>
              <li>
                {!shouldLink ? (
                  <span className="capitalize font-semibold">
                    {label}
                  </span>
                ) : (
                  <Link
                    href={href}
                    className="capitalize hover:text-indigo-600 font-medium transition"
                  >
                    {label}
                  </Link>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
};

export default BreadCrumb;
