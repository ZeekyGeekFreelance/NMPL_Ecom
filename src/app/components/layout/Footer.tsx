"use client";

import React from "react";
import Link from "next/link";


import { useAuth } from "@/app/hooks/useAuth";
import { useGetAllCategoriesQuery } from "@/app/store/apis/CategoryApi";
import { PLATFORM_NAME, SUPPORT_EMAIL } from "@/app/lib/constants/config";
import {
  Headset,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Truck,
  Wallet,
} from "lucide-react";

type FooterLink = {
  href: string;
  label: string;
  hideForAdmin?: boolean;
  authOnly?: boolean;
};

const FOOTER_LINKS: FooterLink[] = [
  { href: "/", label: "Home", hideForAdmin: true },
  { href: "/shop", label: "Shop", hideForAdmin: true },
  { href: "/cart", label: "Cart", authOnly: true, hideForAdmin: true },
  { href: "/orders", label: "My Orders", authOnly: true, hideForAdmin: true },
  { href: "/profile", label: "Profile", authOnly: true },
  { href: "/support", label: "Support", authOnly: true, hideForAdmin: true },
];

const AUTH_LINKS = [
  { href: "/sign-in", label: "Sign in" },
  { href: "/sign-up", label: "Create account" },
  { href: "/password-reset", label: "Reset password" },
];

const Footer = () => {
  const { user, isAuthenticated } = useAuth();
  const { data: categoriesData } = useGetAllCategoriesQuery({});
  const categories = (categoriesData?.categories || []).slice(0, 6);
  const year = new Date().getFullYear();
  const isAdminOrSuperAdmin =
    user?.role === "ADMIN" || user?.role === "SUPERADMIN";
  const visibleFooterLinks = FOOTER_LINKS.filter((link) => {
    if (isAdminOrSuperAdmin && link.hideForAdmin) {
      return false;
    }

    if (link.authOnly && !isAuthenticated) {
      return false;
    }

    return true;
  });
  const supportHref = "/support";
  const supportDescription =
    "Email our support team for payments, order updates, account access, or dealer help.";
  const footerGridColumns = isAdminOrSuperAdmin
    ? "grid-cols-1 md:grid-cols-3"
    : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4";

  return (
    <footer className="mt-16 bg-slate-950 text-slate-200">
      <div className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-3 rounded-lg bg-slate-900/80 px-4 py-3">
            <ShieldCheck
              size={18}
              style={{ color: "var(--color-secondary)" }}
            />
            <span className="text-sm">Verified checkout security</span>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-slate-900/80 px-4 py-3">
            <Wallet size={18} style={{ color: "var(--color-secondary)" }} />
            <span className="text-sm">Secure online payment capture</span>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-slate-900/80 px-4 py-3">
            <Truck size={18} style={{ color: "var(--color-secondary)" }} />
            <span className="text-sm">Fast dispatch updates</span>
          </div>
        </div>
      </div>

      <div
        className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid ${footerGridColumns} gap-10`}
      >
        <div>
          <h3 className="text-lg font-semibold text-white sm:text-xl">
            Why NMPL
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            {PLATFORM_NAME} helps dealers and manufacturers source products
            faster with clear pricing, secure payments, and dependable dispatch
            visibility.
          </p>
          <div className="mt-5 space-y-2 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <MapPin size={14} />
              <span>Bangalore, India</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone size={14} />
              <span>+1 (555) 123-4567</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail size={14} />
              <span>{SUPPORT_EMAIL}</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Explore
          </h4>
          <ul className="mt-4 space-y-2">
            {visibleFooterLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {!isAdminOrSuperAdmin && (
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Categories
            </h4>
            <ul className="mt-4 space-y-2">
              {categories.length > 0 ? (
                categories.map((category: any) => (
                  <li key={category.id}>
                    <Link
                      href={`/shop?categoryId=${category.id}`}
                      className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      {category.name}
                    </Link>
                  </li>
                ))
              ) : (
                <li className="text-sm text-slate-500">No categories yet</li>
              )}
            </ul>
          </div>
        )}

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Account
          </h4>
          <ul className="mt-4 space-y-2">
            {AUTH_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900/80 p-4">
            <div className="flex items-center gap-2 text-slate-300">
              <Headset size={16} style={{ color: "var(--color-secondary)" }} />
              <span className="text-sm font-medium">Need help?</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">{supportDescription}</p>
            <Link
              href={supportHref}
              className="mt-3 inline-block text-sm font-medium"
              style={{ color: "var(--color-secondary)" }}
            >
              Contact support
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center text-xs text-slate-500">
          <p>
            &copy; {year} {PLATFORM_NAME}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
