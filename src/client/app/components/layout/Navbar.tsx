"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  ShoppingCart,
  Store,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import SearchBar from "../molecules/SearchBar";
import UserMenu from "../molecules/UserMenu";
import { useGetCartCountQuery } from "@/app/store/apis/CartApi";
import useClickOutside from "@/app/hooks/dom/useClickOutside";
import useEventListener from "@/app/hooks/dom/useEventListener";
import { useAuth } from "@/app/hooks/useAuth";
import { useSignOutMutation } from "@/app/store/apis/AuthApi";
import { generateUserAvatar } from "@/app/utils/placeholderImage";
import { useGetAllCategoriesQuery } from "@/app/store/apis/CategoryApi";
import { PLATFORM_NAME } from "@/app/lib/constants/config";
import {
  isAdminDisplayRole,
  isCustomerDisplayRole,
  resolveDisplayRole,
} from "@/app/lib/userRole";

type NavLink = {
  href: string;
  label: string;
  authOnly?: boolean;
  guestOnly?: boolean;
  adminOnly?: boolean;
  hideForAdmin?: boolean;
  roles?: Array<"ADMIN" | "SUPERADMIN">;
};

const STORE_LINKS: NavLink[] = [
  { href: "/", label: "Home", hideForAdmin: true },
  { href: "/shop", label: "Shop", hideForAdmin: true },
  { href: "/products", label: "Products", hideForAdmin: true },
  { href: "/brands", label: "Brands", hideForAdmin: true },
  { href: "/about-us", label: "About Us", hideForAdmin: true },
  { href: "/cart", label: "Cart", authOnly: true, hideForAdmin: true },
  { href: "/orders", label: "Orders", authOnly: true, hideForAdmin: true },
  { href: "/profile", label: "Profile", authOnly: true },
  { href: "/support", label: "Support", authOnly: true, hideForAdmin: true },
  { href: "/sign-in", label: "Sign in", guestOnly: true },
  { href: "/sign-up", label: "Create account", guestOnly: true },
];

const ADMIN_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["ADMIN", "SUPERADMIN"] },
  { href: "/dashboard/products", label: "Products", roles: ["ADMIN", "SUPERADMIN"] },
  { href: "/dashboard/categories", label: "Categories", roles: ["ADMIN", "SUPERADMIN"] },
  { href: "/dashboard/inventory", label: "Inventory", roles: ["ADMIN", "SUPERADMIN"] },
  { href: "/dashboard/transactions", label: "Transactions", roles: ["ADMIN", "SUPERADMIN"] },
  { href: "/dashboard/dealers", label: "Dealers", roles: ["ADMIN", "SUPERADMIN"] },
  { href: "/dashboard/analytics", label: "Analytics", roles: ["ADMIN", "SUPERADMIN"] },
  { href: "/dashboard/reports", label: "Reports", roles: ["ADMIN", "SUPERADMIN"] },
  { href: "/dashboard/users", label: "Users", roles: ["SUPERADMIN"] },
  { href: "/dashboard/logs", label: "Logs", roles: ["SUPERADMIN"] },
];

const Navbar = () => {
  const pathname = usePathname();
  const [signOut] = useSignOutMutation();
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();
  const displayRole = resolveDisplayRole(user);
  const isAdmin = isAuthenticated && isAdminDisplayRole(displayRole);
  const isCustomerUser = isAuthenticated && isCustomerDisplayRole(displayRole);
  const shouldShowCart = isAuthenticated && isCustomerUser;
  const { data: cartData } = useGetCartCountQuery(undefined, {
    skip: !shouldShowCart,
    refetchOnMountOrArgChange: true,
  });
  const { data: categoriesData } = useGetAllCategoriesQuery({});

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const categoriesRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(
    () => (categoriesData?.categories || []).slice(0, 8),
    [categoriesData?.categories]
  );
  const cartCount = cartData?.cartCount || 0;
  const brandHref = isAdmin ? "/dashboard" : "/";

  useEventListener("scroll", () => {
    setScrolled(window.scrollY > 20);
  });

  useClickOutside(menuRef, () => setMenuOpen(false));
  useClickOutside(mobileMenuRef, () => setMobileMenuOpen(false));
  useClickOutside(categoriesRef, () => setCategoriesOpen(false));

  React.useEffect(() => {
    if (!mobileMenuOpen) {
      setMobileCategoriesOpen(false);
    }
  }, [mobileMenuOpen]);

  const isRouteActive = (href: string) => {
    const route = href.split("?")[0];

    if (route === "/") {
      return pathname === "/";
    }

    return pathname === route || pathname.startsWith(`${route}/`);
  };

  const getVisibleLinks = (links: NavLink[]) =>
    links.filter((link) => {
      const currentRole = isAdmin
        ? (displayRole as "ADMIN" | "SUPERADMIN")
        : undefined;

      if (link.adminOnly && !isAdmin) return false;
      if (link.roles && (!currentRole || !link.roles.includes(currentRole))) {
        return false;
      }
      if (link.authOnly && !isAuthenticated) return false;
      if (link.guestOnly && isAuthenticated) return false;
      if (link.hideForAdmin && isAdmin) return false;
      return true;
    });

  const visibleStoreLinks = getVisibleLinks(STORE_LINKS);
  const visibleAdminLinks = getVisibleLinks(ADMIN_LINKS);

  const handleSignOut = async () => {
    try {
      await signOut().unwrap();
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setMobileMenuOpen(false);
      setMobileCategoriesOpen(false);
      router.push("/sign-in");
    }
  };

  return (
    <header
      className={`sticky top-0 z-50 border-b border-gray-200 transition-all duration-300 ${
        scrolled ? "bg-white/95 backdrop-blur-xl shadow-md" : "bg-white"
      }`}
    >
      <div className="bg-slate-900 text-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between text-xs">
          <p className="truncate">
            No online payment enabled. Every order requires explicit confirmation.
          </p>
          {!isAdmin && (
            <div className="hidden md:flex items-center gap-4">
              <Link href="/shop?isNew=true" className="hover:text-white">
                New Arrivals
              </Link>
              <Link href="/shop?isTrending=true" className="hover:text-white">
                Trending
              </Link>
            </div>
          )}
        </div>
      </div>

      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          <Link
            href={brandHref}
            className="flex items-center gap-2 text-gray-900 font-semibold text-base sm:text-lg"
          >
            <span className="rounded-lg bg-teal-700 text-white p-1.5">
              <Store size={18} />
            </span>
            <span>{PLATFORM_NAME}</span>
          </Link>

          <div className="hidden lg:flex flex-1 max-w-xl mx-4">
            <SearchBar />
          </div>

          <div className="flex items-center space-x-1 sm:space-x-2">
            <button
              onClick={() => setMobileSearchOpen((prev) => !prev)}
              className="lg:hidden p-2 text-gray-700 hover:text-teal-700 transition-colors"
              aria-label="Search"
            >
              <Search size={20} />
            </button>

            {shouldShowCart && (
              <Link
                href="/cart"
                className="relative p-2 text-gray-700 hover:text-teal-700 transition-colors"
                aria-label="Shopping cart"
              >
                <ShoppingCart className="text-[20px] sm:text-[22px]" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-teal-700 text-white text-xs font-medium rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </Link>
            )}

            {isLoading ? (
              <div className="w-8 h-8 rounded-full border border-gray-300 bg-gray-100 animate-pulse" />
            ) : isAuthenticated ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="flex items-center p-1 rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="User menu"
                >
                  {user?.avatar ? (
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-300">
                      <Image
                        src={user.avatar}
                        alt="User Profile"
                        width={32}
                        height={32}
                        className="rounded-full object-cover w-full h-full"
                        onError={(event) => {
                          event.currentTarget.src = generateUserAvatar(
                            user.name
                          );
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-300">
                      <Image
                        src={generateUserAvatar(user?.name || "User")}
                        alt="User Profile"
                        width={32}
                        height={32}
                        className="rounded-full object-cover w-full h-full"
                      />
                    </div>
                  )}
                </button>
                {menuOpen && (
                  <UserMenu
                    user={user}
                    menuOpen={menuOpen}
                    closeMenu={() => setMenuOpen(false)}
                  />
                )}
              </div>
            ) : (
              pathname !== "/sign-up" &&
              pathname !== "/sign-in" && (
                <div className="hidden sm:flex items-center gap-2">
                  <Link
                    href="/sign-in"
                    className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-teal-700 transition-colors"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/sign-up"
                    className="px-3 py-2 text-sm font-medium bg-teal-700 text-white rounded-md hover:bg-teal-800 transition-colors"
                  >
                    Sign up
                  </Link>
                </div>
              )
            )}

            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden p-2 text-gray-700 hover:text-teal-700 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {mobileSearchOpen && (
          <div className="lg:hidden py-3 border-t border-gray-200">
            <SearchBar />
          </div>
        )}

        <div className="hidden md:flex items-center justify-between border-t border-gray-100 py-2">
          <div className="flex items-center gap-1 flex-wrap">
            {visibleStoreLinks
              .filter((link) => link.label !== "Sign in" && link.label !== "Create account")
              .map((link) => (
                <React.Fragment key={link.href}>
                  <Link
                    href={link.href}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isRouteActive(link.href)
                        ? "bg-teal-50 text-teal-700"
                        : "text-gray-700 hover:text-teal-700 hover:bg-gray-50"
                    }`}
                  >
                    {link.label}
                  </Link>

                  {!isAdmin && link.href === "/shop" && (
                    <div className="relative" ref={categoriesRef}>
                      <button
                        onClick={() => setCategoriesOpen((prev) => !prev)}
                        className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-700 hover:text-teal-700 hover:bg-gray-50 inline-flex items-center gap-1"
                      >
                        Categories
                        <ChevronDown size={15} />
                      </button>

                      {categoriesOpen && (
                        <div className="absolute top-full left-0 mt-2 w-72 rounded-xl border border-gray-200 bg-white shadow-lg p-3 z-50">
                          <div className="grid grid-cols-2 gap-2">
                            {categories.map((category: any) => (
                              <Link
                                key={category.id}
                                href={`/shop?categoryId=${category.id}`}
                                onClick={() => setCategoriesOpen(false)}
                                className="text-sm px-2 py-1.5 rounded-md text-gray-700 hover:bg-teal-50 hover:text-teal-700"
                              >
                                {category.name}
                              </Link>
                            ))}
                          </div>
                          <Link
                            href="/shop"
                            onClick={() => setCategoriesOpen(false)}
                            className="mt-3 block text-center rounded-md bg-teal-700 text-white py-2 text-sm hover:bg-teal-800"
                          >
                            View All Categories
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </React.Fragment>
              ))}
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium text-teal-800 bg-teal-100 hover:bg-teal-200"
              >
                <LayoutDashboard size={14} />
                Admin Dashboard
              </Link>
            </div>
          )}
        </div>

        {mobileMenuOpen && (
          <div
            ref={mobileMenuRef}
            className="md:hidden absolute top-full left-0 right-0 bg-white shadow-xl border-t border-gray-200"
          >
            <div className="px-4 py-4 max-h-[calc(100vh-110px)] overflow-y-auto">
              <div className="space-y-1">
                {visibleStoreLinks.map((link) => (
                  <React.Fragment key={link.href}>
                    <Link
                      href={link.href}
                      className={`block px-3 py-2.5 rounded-md text-sm ${
                        isRouteActive(link.href)
                          ? "bg-teal-50 text-teal-700 font-medium"
                          : "text-gray-800 hover:bg-gray-100"
                      }`}
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setMobileCategoriesOpen(false);
                      }}
                    >
                      {link.label}
                    </Link>

                    {!isAdmin && link.href === "/shop" && categories.length > 0 && (
                      <div className="px-1">
                        <button
                          onClick={() =>
                            setMobileCategoriesOpen((prev) => !prev)
                          }
                          className="w-full px-2 py-2 rounded-md text-left text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 inline-flex items-center justify-between"
                        >
                          Categories
                          <ChevronDown
                            size={15}
                            className={`transition-transform ${
                              mobileCategoriesOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {mobileCategoriesOpen && (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            {categories.map((category: any) => (
                              <Link
                                key={category.id}
                                href={`/shop?categoryId=${category.id}`}
                                className="px-3 py-2 text-sm rounded-md text-gray-700 bg-gray-50 hover:bg-teal-50 hover:text-teal-700"
                                onClick={() => {
                                  setMobileMenuOpen(false);
                                  setMobileCategoriesOpen(false);
                                }}
                              >
                                {category.name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>

              {isAdmin && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Admin
                  </p>
                  <div className="space-y-1">
                    {visibleAdminLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="block px-3 py-2.5 rounded-md text-sm text-gray-800 hover:bg-gray-100"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {isAuthenticated && (
                <button
                  onClick={handleSignOut}
                  className="mt-4 flex items-center w-full px-3 py-2.5 gap-2 rounded-md text-red-700 bg-red-50 hover:bg-red-100 text-sm font-medium"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Navbar;
