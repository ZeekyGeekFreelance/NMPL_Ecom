"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/hooks/useAuth";
import { resolveDisplayRole } from "@/app/lib/userRole";
import {
  LayoutDashboard,
  ShoppingCart,
  Layers,
  Percent,
  SlidersHorizontal,
  Users,
  Boxes,
  ChartCandlestick,
  ClipboardPlus,
  ClipboardCheck,
  Section,
  Truck,
  CreditCard,
} from "lucide-react";

type SidebarNotificationKey =
  | "dashboard"
  | "products"
  | "inventory"
  | "attributes"
  | "categories"
  | "deliveryFees"
  | "transactions"
  | "payments"
  | "gst"
  | "dealers"
  | "users"
  | "analytics"
  | "reports"
  | "logs";

type SidebarNotifications = Partial<Record<SidebarNotificationKey, number>>;

type SidebarProps = {
  notifications?: SidebarNotifications;
};

const Sidebar = ({ notifications = {} }: SidebarProps) => {
  const pathname = usePathname();
  const { user } = useAuth();

  const sections = useMemo(
    () => [
      {
        title: "Overview",
        links: [
          {
            id: "dashboard" as SidebarNotificationKey,
            name: "Dashboard",
            href: "/dashboard",
            icon: LayoutDashboard,
            roles: ["ADMIN", "SUPERADMIN"],
          },
        ],
      },
      {
        title: "Commerce",
        links: [
          {
            id: "products" as SidebarNotificationKey,
            name: "Products",
            href: "/products",
            icon: Layers,
            roles: ["ADMIN", "SUPERADMIN"],
          },
          {
            id: "inventory" as SidebarNotificationKey,
            name: "Inventory",
            href: "/inventory",
            icon: Section,
            roles: ["ADMIN", "SUPERADMIN"],
          },
          {
            id: "attributes" as SidebarNotificationKey,
            name: "Attributes",
            href: "/attributes",
            icon: SlidersHorizontal,
            roles: ["ADMIN", "SUPERADMIN"],
          },
          {
            id: "categories" as SidebarNotificationKey,
            name: "Categories",
            href: "/categories",
            icon: Boxes,
            roles: ["ADMIN", "SUPERADMIN"],
          },
          {
            id: "deliveryFees" as SidebarNotificationKey,
            name: "Delivery Fees",
            href: "/delivery-fees",
            icon: Truck,
            roles: ["ADMIN", "SUPERADMIN"],
          },
          {
            id: "transactions" as SidebarNotificationKey,
            name: "Transactions",
            href: "/transactions",
            icon: ShoppingCart,
            roles: ["ADMIN", "SUPERADMIN"],
          },
          {
            id: "payments" as SidebarNotificationKey,
            name: "Payments",
            href: "/payments",
            icon: CreditCard,
            roles: ["ADMIN", "SUPERADMIN"],
          },
          {
            id: "gst" as SidebarNotificationKey,
            name: "GST",
            href: "/gst",
            icon: Percent,
            roles: ["ADMIN", "SUPERADMIN"],
          },
          {
            id: "dealers" as SidebarNotificationKey,
            name: "Dealers",
            href: "/dealers",
            icon: Users,
            roles: ["ADMIN", "SUPERADMIN"],
          },
          {
            id: "users" as SidebarNotificationKey,
            name: "Users",
            href: "/users",
            icon: Users,
            roles: ["SUPERADMIN"],
          },
        ],
      },
      {
        title: "Insights",
        links: [
          {
            id: "analytics" as SidebarNotificationKey,
            name: "Analytics",
            href: "/analytics",
            icon: ChartCandlestick,
            roles: ["ADMIN", "SUPERADMIN"],
          },
          {
            id: "reports" as SidebarNotificationKey,
            name: "Reports",
            href: "/reports",
            icon: ClipboardPlus,
            roles: ["ADMIN", "SUPERADMIN"],
          },
          {
            id: "logs" as SidebarNotificationKey,
            name: "Logs",
            href: "/logs",
            icon: ClipboardCheck,
            roles: ["SUPERADMIN"],
          },
        ],
      },
    ],
    []
  );

  const visibleSections = useMemo(() => {
    const currentRole = resolveDisplayRole(user);

    return sections
      .map((section) => ({
        ...section,
        links: section.links.filter((link) =>
          link.roles ? link.roles.includes(currentRole) : true
        ),
      }))
      .filter((section) => section.links.length > 0);
  }, [sections, user?.role]);

  const prependDashboard = (href: string) =>
    href.startsWith("/dashboard") ? href : `/dashboard${href}`;

  const isRouteActive = (href: string) => {
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const SidebarLink = ({
    id,
    name,
    href,
    Icon,
  }: {
    id: SidebarNotificationKey;
    name: string;
    href: string;
    Icon: React.ElementType;
  }) => {
    const fullHref = prependDashboard(href);
    const active = isRouteActive(fullHref);
    const notificationCount = notifications[id] || 0;
    const hasNotification = notificationCount > 0;

    return (
      <Link
        href={fullHref}
        prefetch={false}
        className={`group flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200 ${
          hasNotification && !active
            ? "border-transparent"
            : "border-transparent"
        } ${
          active
            ? "text-white"
            : hasNotification
            ? "text-gray-800 hover:bg-gray-50"
            : "text-gray-700 hover:border-gray-200 hover:bg-gray-50"
        }`}
        style={active ? { backgroundColor: 'var(--color-primary)', borderColor: 'transparent' } : {}}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative">
            <Icon
              className={`h-5 w-5 ${
                active
                  ? "text-white"
                  : hasNotification
                  ? "text-gray-700"
                  : "text-gray-500 group-hover:text-gray-700"
              }`}
            />
            {hasNotification && (
              <span className="absolute -right-1.5 -top-1.5 inline-flex h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ backgroundColor: 'var(--color-error)' }} />
            )}
          </div>
          <span className="truncate text-sm font-medium">{name}</span>
        </div>

        {hasNotification && (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: 'var(--color-error)' }}>
            {notificationCount > 99 ? "99+" : notificationCount}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className="hidden lg:flex h-screen w-72 shrink-0 flex-col border-r border-gray-200 bg-white px-4 py-5">
      <div className="mb-4 px-2">
        <h2 className="text-base font-semibold text-gray-900">Admin Navigation</h2>
        <p className="mt-1 text-xs text-gray-500">
          Quick access to operational modules
        </p>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto pr-1">
        {visibleSections.map((section, index) => (
          <div key={section.title}>
            <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {section.title}
            </h3>
            <div className="space-y-1.5">
              {section.links.map((link) => (
                <SidebarLink
                  key={link.id}
                  id={link.id}
                  name={link.name}
                  href={link.href}
                  Icon={link.icon}
                />
              ))}
            </div>
            {index < visibleSections.length - 1 && (
              <hr className="mt-4 border-gray-100" />
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
