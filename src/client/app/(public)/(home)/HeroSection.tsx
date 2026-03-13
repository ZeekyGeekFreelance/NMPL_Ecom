"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type TouchEvent,
} from "react";

interface HeroSectionProps {
  isPreview?: boolean;
}

const sliderData = [
  {
    image: "/images/hero/HeroSlide.png",
    focus: {
      mobile: "52% 84%",
      tablet: "56% 66%",
      desktop: "62% 48%",
      mobileZoom: "1.14",
      mobileShift: "7%",
    },
    eyebrow: "Industrial Supply",
    overlayTag: "Supply Backbone",
    overlayTitle: "Precision stock for uninterrupted production cycles.",
    overlayNote:
      "Calibrated quality, predictable availability, and repeat-ready fulfillment for industrial teams.",
    title: "One trusted store for high-volume sewing production",
    subtitle:
      "Source quality needles, keep ordering simple, and manage every confirmed order from one place.",
    primaryCtaText: "Browse Catalog",
    primaryCtaLink: "/shop",
    secondaryCtaText: "Become a Dealer",
    secondaryCtaLink: "/dealer/register",
  },
  {
    image: "/images/hero/HeroSlide3.jpg",
    focus: {
      mobile: "53% 84%",
      tablet: "58% 64%",
      desktop: "63% 46%",
      mobileZoom: "1.14",
      mobileShift: "7%",
    },
    eyebrow: "Dealer Network",
    overlayTag: "Dealer Program",
    overlayTitle: "Reliable restock cadence with confirmation-first processing.",
    overlayNote:
      "Built for teams that need recurring procurement without last-minute uncertainty.",
    title: "Built for garment units that need reliable repeat supply",
    subtitle:
      "Clear B2B pricing, confirmation-first processing, and dependable dispatch timelines for every cycle.",
    primaryCtaText: "Request Dealer Access",
    primaryCtaLink: "/dealer/register",
    secondaryCtaText: "View Products",
    secondaryCtaLink: "/shop",
  },
  {
    image: "/images/hero/HeroSlide2.png",
    focus: {
      mobile: "52% 86%",
      tablet: "57% 65%",
      desktop: "62% 47%",
      mobileZoom: "1.16",
      mobileShift: "8%",
    },
    eyebrow: "Order Confidence",
    overlayTag: "Operational Clarity",
    overlayTitle: "From approval to dispatch, every step stays visible.",
    overlayNote:
      "Structured order states reduce follow-up overhead and keep production planning stable.",
    title: "From approval to dispatch, your order lifecycle stays transparent",
    subtitle:
      "Track confirmed workflows clearly and reduce back-and-forth with a structured ordering process.",
    primaryCtaText: "How It Works",
    primaryCtaLink: "/about-us",
    secondaryCtaText: "Shop Now",
    secondaryCtaLink: "/shop",
  },
];

const slideVariants = {
  enter: { opacity: 0, scale: 1.02 },
  center: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.99 },
};

const HeroSection = ({ isPreview = false }: HeroSectionProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (isPreview) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % sliderData.length);
    }, 7000);

    return () => clearInterval(interval);
  }, [isPreview]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % sliderData.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + sliderData.length) % sliderData.length);
  };

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const swipeStart = swipeStartRef.current;
    swipeStartRef.current = null;

    if (!swipeStart) {
      return;
    }

    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }

    const deltaX = touch.clientX - swipeStart.x;
    const deltaY = touch.clientY - swipeStart.y;
    const swipeThreshold = 45;

    if (Math.abs(deltaX) < swipeThreshold || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    if (deltaX > 0) {
      prevSlide();
      return;
    }

    nextSlide();
  };

  const currentSlide = sliderData[currentIndex];
  const imageFocusVars = {
    "--hero-focus-mobile": currentSlide.focus.mobile,
    "--hero-focus-tablet": currentSlide.focus.tablet,
    "--hero-focus-desktop": currentSlide.focus.desktop,
    "--hero-mobile-zoom": currentSlide.focus.mobileZoom,
    "--hero-mobile-shift": currentSlide.focus.mobileShift,
  } as CSSProperties;

  return (
    <section
      className={`relative w-full ${
        isPreview ? "my-2 scale-90" : "my-4 sm:my-6 lg:my-8"
      }`}
    >
      <div
        className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-sm"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="relative aspect-[16/11] sm:aspect-[16/9] lg:aspect-[16/7] overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.75, ease: "easeOut" }}
              className="absolute inset-0"
            >
              <Image
                src={currentSlide.image}
                alt={currentSlide.title}
                fill
                priority={currentIndex === 0}
                className="object-cover [object-position:var(--hero-focus-mobile)] sm:[object-position:var(--hero-focus-tablet)] lg:[object-position:var(--hero-focus-desktop)] [transform:translateY(var(--hero-mobile-shift))_scale(var(--hero-mobile-zoom))] sm:[transform:none]"
                sizes="100vw"
                unoptimized
                style={imageFocusVars}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-white/55 via-white/15 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/60 to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[44%] items-center pl-10 lg:flex xl:pl-14">
                <div className="max-w-md text-left">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-700/85">
                    {currentSlide.overlayTag}
                  </p>
                  <p className="mt-3 text-[clamp(1.35rem,2vw,2.2rem)] font-semibold leading-tight text-slate-900/65">
                    {currentSlide.overlayTitle}
                  </p>
                  <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-700/75">
                    {currentSlide.overlayNote}
                  </p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="px-5 py-8 text-center sm:px-8 sm:py-10 lg:px-12 lg:py-12">
          <p
            className="text-xs font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--color-secondary)" }}
          >
            {currentSlide.eyebrow}
          </p>
          <h1 className="type-h1 mx-auto mt-3 max-w-3xl text-slate-900">
            {currentSlide.title}
          </h1>
          <p className="type-body mx-auto mt-4 max-w-2xl text-slate-600">
            {currentSlide.subtitle}
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={currentSlide.primaryCtaLink}
              className="btn-cta !h-11 !rounded-lg !px-5 text-sm font-semibold"
            >
              {currentSlide.primaryCtaText}
              <ArrowRight size={16} />
            </Link>
            <Link
              href={currentSlide.secondaryCtaLink}
              className="btn-secondary !h-11 !rounded-lg !px-5 text-sm font-semibold"
            >
              {currentSlide.secondaryCtaText}
            </Link>
          </div>

          <div className="mt-7 flex items-center justify-center gap-2">
            {sliderData.map((slide, index) => (
              <button
                key={slide.title}
                type="button"
                onClick={() => goToSlide(index)}
                aria-label={`Show slide ${index + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? "w-8"
                    : "w-2 hover:opacity-80"
                }`}
                style={{
                  backgroundColor:
                    index === currentIndex
                      ? "var(--color-primary)"
                      : "rgba(29, 52, 97, 0.35)",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;

