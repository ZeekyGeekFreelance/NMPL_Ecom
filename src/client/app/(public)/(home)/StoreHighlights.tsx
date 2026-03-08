"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Headset, ShieldCheck, Truck, Wallet } from "lucide-react";

const HIGHLIGHTS = [
  {
    icon: ShieldCheck,
    title: "Confirmation-First Ordering",
    description:
      "Every order is verified before dispatch. No payment is captured until your order is approved.",
  },
  {
    icon: Wallet,
    title: "Secure B2B Pricing",
    description:
      "Approved dealers receive exclusive pricing. Transparent costs with no surprise charges.",
  },
  {
    icon: Truck,
    title: "Tracked Dispatch",
    description:
      "Real-time shipment updates from confirmation to delivery, accessible from your orders page.",
  },
  {
    icon: Headset,
    title: "Direct Support",
    description:
      "Dedicated support for order verification, account issues, and dealer inquiries.",
  },
];

const COLLECTIONS = [
  {
    title: "New Additions",
    href: "/shop?isNew=true",
    subtitle: "Freshly added to the industrial catalog",
  },
  {
    title: "Featured Products",
    href: "/shop?isFeatured=true",
    subtitle: "Precision-selected for performance",
  },
  {
    title: "High-Volume Lines",
    href: "/shop?isBestSeller=true",
    subtitle: "Most reordered by manufacturing units",
  },
];

const StoreHighlights = () => {
  return (
    <section className="py-8 sm:py-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {HIGHLIGHTS.map((item, index) => (
          <motion.article
            key={item.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.08 }}
            className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur p-5 shadow-sm"
          >
            <div className="inline-flex rounded-lg p-2" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
              <item.icon size={18} />
            </div>
            <h3 className="mt-3 text-sm sm:text-base font-semibold text-slate-900">
              {item.title}
            </h3>
            <p className="mt-2 prose-section text-slate-600">
              {item.description}
            </p>
          </motion.article>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLLECTIONS.map((collection, index) => (
          <motion.div
            key={collection.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 + index * 0.08 }}
            className="rounded-2xl bg-slate-900 text-white p-5"
          >
            <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--color-secondary)' }}>
              Collection
            </p>
            <h4 className="mt-1 text-lg sm:text-xl font-semibold">{collection.title}</h4>
            <p className="mt-2 type-body-sm text-slate-300">{collection.subtitle}</p>
            <Link
              href={collection.href}
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium"
              style={{ color: 'var(--color-secondary)' }}
            >
              Explore
              <ArrowRight size={14} />
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default StoreHighlights;
