"use client";

import Image from "next/image";
import { animate, motion, useInView } from "framer-motion";
import { CreditCard, Headset, ShieldCheck, Truck } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";

type ShowcaseStat = {
  label: string;
  value: number;
  suffix: string;
};

type AnimatedStatProps = ShowcaseStat & {
  delay: number;
};

const SHOWCASE_STATS: ShowcaseStat[] = [
  { value: 30, suffix: "+", label: "years of experience" },
  { value: 4500, suffix: "+", label: "product varieties" },
  { value: 300, suffix: "+", label: "happy clients" },
  { value: 25, suffix: "+", label: "brands available" },
];

const HIGHLIGHTS = [
  {
    icon: ShieldCheck,
    title: "Verified Order Quality",
    description:
      "Every order is validated for quantity and product details before processing.",
  },
  {
    icon: CreditCard,
    title: "Secure Online Payments",
    description:
      "Protected payment flow with transparent billing and streamlined checkout.",
  },
  {
    icon: Truck,
    title: "Reliable Dispatch",
    description:
      "Dispatch is coordinated quickly with clear status updates throughout fulfillment.",
  },
  {
    icon: Headset,
    title: "Direct Support",
    description:
      "Dedicated support for payments, order updates, and dealer onboarding.",
  },
];

type BrandLogoAsset = {
  name: string;
  src: string;
  frameClass?: string;
  bandClass?: string;
  bandHeight?: string;
  logoScale?: number;
  logoOffsetY?: string;
  logoObjectPosition?: string;
  plateInsetX?: string;
  plateTop?: string;
  plateBottom?: string;
};

const FEATURED_BRANDS: BrandLogoAsset[] = [
  // {
  //   name: "Groz Beckert",
  //   src: "/images/branding/partners/cards/groz_logo.png",
  //   frameClass: "bg-emerald-800/10",
  //   bandClass: "bg-emerald-800",
  //   bandHeight: "h-[22%]",
  //   logoScale: 1.12,
  //   logoOffsetY: "-2px",
  //   logoObjectPosition: "center",
  //   plateInsetX: "0.625rem",
  //   plateTop: "0.625rem",
  //   plateBottom: "22%",
  // },

  {
    name: "Groz Beckert",
    src: "/images/branding/partners/cards/groz_logo.png",
    frameClass: "bg-emerald-800/10",
    bandClass: "bg-emerald-800",
    logoScale: 1.3,
  },
  {
    name: "Typical",
    src: "/images/branding/partners/cards/typical_logo.jpg",
    frameClass: "bg-indigo-800/10",
    bandClass: "bg-indigo-900",
    logoScale: 1.03,
  },
  {
    name: "Dot",
    src: "/images/branding/partners/cards/Dot_Logo.jpg",
    frameClass: "bg-slate-900/10",
    bandClass: "bg-black",
    logoScale: 1.02,
  },
  {
    name: "Strong H",
    src: "/images/branding/partners/cards/strong_h.jpg",
    frameClass: "bg-blue-800/10",
    bandClass: "bg-blue-900",
    logoScale: 1.52,
    logoOffsetY: "-2px",
  },
  {
    name: "Yoke",
    src: "/images/branding/partners/cards/yoke_logo.png",
    frameClass: "bg-cyan-700/10",
    bandClass: "bg-sky-600",
    logoScale: 1.1,
  },
  {
    name: "Aktion",
    src: "/images/branding/partners/cards/pinAction_logo.jpg",
    frameClass: "bg-red-900/10",
    bandClass: "bg-gradient-to-r from-red-900 via-amber-700 to-green-800",
    logoScale: 2.68,
  },
];

const BRAND_WORDMARKS: BrandLogoAsset[] = [
  {
    name: "Partner Logos",
    src: "/images/branding/partners/cards/mixed_logo.png",
  },
];

const resolveBandHeight = (value?: string): string => {
  if (!value) {
    return "24%";
  }

  const trimmed = value.trim();
  // Allow both "24%" and legacy "h-[24%]" formats.
  if (trimmed.startsWith("h-[") && trimmed.endsWith("]")) {
    return trimmed.slice(3, -1);
  }

  return trimmed;
};

const AnimatedStat = ({ value, suffix, label, delay }: AnimatedStatProps) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, amount: 0.6 });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) {
      return;
    }

    const controls = animate(0, value, {
      duration: 1.2,
      delay,
      ease: "easeOut",
      onUpdate: (latest) => {
        setCount(Math.round(latest));
      },
    });

    return () => controls.stop();
  }, [delay, isInView, value]);

  return (
    <motion.article
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.35, delay }}
      className="text-center"
    >
      <p className="font-serif text-4xl sm:text-5xl text-slate-900">
        {count.toLocaleString()}
        {suffix}
      </p>
      <p className="mt-2 text-sm sm:text-base text-slate-700">{label}</p>
    </motion.article>
  );
};

const StoreHighlights = () => {
  return (
    <section className="py-10 sm:py-12 lg:py-14">
      <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-12 text-center shadow-sm sm:px-10">
        <h2 className="mx-auto max-w-3xl font-serif text-4xl leading-tight text-slate-900 sm:text-5xl">
          One store for all your sewing solutions
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base text-slate-600">
          Uniting the garment industry altogether.
        </p>
      </div>

      <div
        className="mt-14 rounded-[28px] px-6 py-12 sm:mt-16 sm:px-10 lg:mt-20"
        style={{ backgroundColor: "var(--color-primary-light)" }}
      >
        <p className="text-center font-serif text-3xl leading-tight text-slate-900 sm:text-4xl">
          Escalating those numbers through the name we hold
        </p>
        <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">
          {SHOWCASE_STATS.map((stat, index) => (
            <AnimatedStat
              key={stat.label}
              value={stat.value}
              suffix={stat.suffix}
              label={stat.label}
              delay={index * 0.1}
            />
          ))}
        </div>
      </div>

      <div className="mt-14 text-center sm:mt-16 lg:mt-20">
        <h3 className="font-serif text-3xl leading-tight text-slate-900 sm:text-4xl">
          Working with the masters from the industry
        </h3>
      </div>

      <div className="mt-8 rounded-[28px] border border-slate-200 bg-white px-4 py-5 shadow-sm sm:mt-10 sm:px-6 sm:py-6 lg:px-8">
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURED_BRANDS.map((brand) => {
            const bandHeight = resolveBandHeight(brand.bandHeight);

            return (
              <div
                key={brand.name}
                className={`relative aspect-[16/10] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${
                  brand.frameClass ?? "bg-slate-100"
                }`}
              >
                <div
                  className={`absolute inset-x-0 bottom-0 z-20 ${brand.bandClass ?? "bg-slate-700"}`}
                  style={{ height: bandHeight }}
                />
                <div
                  className="absolute z-10 sm:inset-x-3 sm:top-3"
                  style={
                    {
                      left: brand.plateInsetX ?? "0.625rem",
                      right: brand.plateInsetX ?? "0.625rem",
                      top: brand.plateTop ?? "0.625rem",
                      bottom: brand.plateBottom ?? bandHeight,
                    } as CSSProperties
                  }
                >
                  <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl border border-white/90 bg-white">
                    <Image
                      src={brand.src}
                      alt={`${brand.name} logo placeholder`}
                      width={560}
                      height={360}
                      className="h-[62%] w-[84%] object-contain"
                      style={
                        {
                          objectPosition: brand.logoObjectPosition ?? "center",
                          transformOrigin: "center center",
                          transform: `translateY(${brand.logoOffsetY ?? "0px"}) scale(${
                            brand.logoScale ?? 1
                          })`,
                        } as CSSProperties
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
          <div className="mx-auto max-w-5xl">
            {BRAND_WORDMARKS.map((brand) => (
              <div
                key={brand.name}
                className="rounded-xl border border-slate-200 bg-white p-2 sm:p-3"
              >
                <Image
                  src={brand.src}
                  alt={`${brand.name} wordmark placeholder`}
                  width={1440}
                  height={280}
                  className="h-auto w-full object-contain"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-5 sm:mt-12 sm:grid-cols-2 lg:mt-14 lg:grid-cols-4">
        {HIGHLIGHTS.map((item, index) => (
          <motion.article
            key={item.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.35, delay: index * 0.08 }}
            className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm"
          >
            <div
              className="inline-flex rounded-lg p-2"
              style={{
                backgroundColor: "var(--color-primary-light)",
                color: "var(--color-primary)",
              }}
            >
              <item.icon size={18} />
            </div>
            <h4 className="mt-3 text-sm font-semibold text-slate-900 sm:text-base">
              {item.title}
            </h4>
            <p className="prose-section mt-2 text-slate-600">
              {item.description}
            </p>
          </motion.article>
        ))}
      </div>
    </section>
  );
};

export default StoreHighlights;
