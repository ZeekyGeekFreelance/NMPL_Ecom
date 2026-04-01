"use client";
import Link from "next/link";
import { ShoppingCart, User, Menu, X } from "lucide-react";
import { useState } from "react";
import { useAppSelector } from "@/app/store/hooks";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const cartCount = useAppSelector((s) => s.cart.count);
  const user = useAppSelector((s) => s.auth.user);

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
        <Link href="/" className="text-xl font-bold text-blue-600">
          {process.env.NEXT_PUBLIC_PLATFORM_NAME ?? "NMPL"}
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-700">
          <Link href="/shop" className="hover:text-blue-600 transition-colors">Shop</Link>
          <Link href="/products" className="hover:text-blue-600 transition-colors">Products</Link>
          <Link href="/brands" className="hover:text-blue-600 transition-colors">Brands</Link>
          <Link href="/about-us" className="hover:text-blue-600 transition-colors">About</Link>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/cart" className="relative p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ShoppingCart size={20} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>
          {user ? (
            <Link href={user.role === "ADMIN" || user.role === "SUPERADMIN" ? "/dashboard" : "/profile"} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <User size={20} />
            </Link>
          ) : (
            <Link href="/sign-in" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              Sign In
            </Link>
          )}
          <button className="md:hidden p-2" onClick={() => setOpen(!open)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t bg-white px-4 py-3 flex flex-col gap-3 text-sm font-medium text-gray-700">
          <Link href="/shop" onClick={() => setOpen(false)}>Shop</Link>
          <Link href="/products" onClick={() => setOpen(false)}>Products</Link>
          <Link href="/brands" onClick={() => setOpen(false)}>Brands</Link>
          <Link href="/about-us" onClick={() => setOpen(false)}>About</Link>
        </div>
      )}
    </nav>
  );
}
