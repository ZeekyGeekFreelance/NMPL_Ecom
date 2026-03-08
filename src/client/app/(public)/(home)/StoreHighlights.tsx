"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Headset, ShieldCheck, Truck, Wallet } from "lucide-react";

const HIGHLIGHTS = [
  {
    icon: ShieldCheck,
    title: "Confirmation-first orders",
    description:
      "Every order requires explicit confirmation before it is finalized.",
  },
  {
    icon: Wallet,
    title: "No online charge right now",
    description:
      "Payments are not captured online during checkout in the current setup.",
  },
  {
    icon: Truck,
    title: "Dispatch updates",
    description:
      "Once confirmed, shipment updates are tracked from your orders section.",
  },
  {
    icon: Headset,
    title: "Live support access",
    description:
      "Use support to resolve order, account, or delivery concerns quickly.",
  },
];

const COLLECTIONS = [
  {
    title: "New Arrivals",
    href: "/shop?isNew=true",
    subtitle: "Just added to the catalog",
  },
  {
    title: "Featured Picks",
    href: "/shop?isFeatured=true",
    subtitle: "Curated products worth checking",
  },
  {
    title: "Best Sellers",
    href: "/shop?isBestSeller=true",
    subtitle: "Popular products customers repeat",
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
            <div className="inline-flex rounded-lg bg-teal-50 p-2 text-teal-700">
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
            <p className="text-xs uppercase tracking-wide text-teal-300">
              Collection
            </p>
            <h4 className="mt-1 text-lg sm:text-xl font-semibold">{collection.title}</h4>
            <p className="mt-2 type-body-sm text-slate-300">{collection.subtitle}</p>
            <Link
              href={collection.href}
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-teal-300 hover:text-teal-200"
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
