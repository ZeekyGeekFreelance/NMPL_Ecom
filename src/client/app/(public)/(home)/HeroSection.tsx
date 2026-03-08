"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef, type TouchEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  ArrowRight,
  Shield,
} from "lucide-react";
import Link from "next/link";

interface HeroSectionProps {
  isPreview?: boolean;
}

// Royalty-free images via Unsplash (free to use under Unsplash License)
const sliderData = [
  {
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80&fit=crop",
    title: "Precision-Engineered for Garment Manufacturing",
    subtitle: "Industrial-grade sewing needles built for high-volume production lines",
    ctaText: "Browse Catalog",
    ctaLink: "/shop",
    badge: "B2B Platform",
  },
  {
    image: "https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=1600&q=80&fit=crop",
    title: "Supplying the Backbone of Global Apparel",
    subtitle: "Consistent quality, reliable supply chain, confirmation-first ordering",
    ctaText: "Request Dealer Access",
    ctaLink: "/dealer/register",
    badge: "Dealer Network",
  },
  {
    image: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=1600&q=80&fit=crop",
    title: "Manufacturing Reliability You Can Count On",
    subtitle: "Every order verified before dispatch — zero payment until confirmation",
    ctaText: "How It Works",
    ctaLink: "/about-us",
    badge: "Verified Process",
  },
  {
    image: "https://images.unsplash.com/photo-1605217613423-0aca4253c04e?w=1600&q=80&fit=crop",
    title: "From Needle to Finished Garment",
    subtitle: "Serving manufacturers, exporters and garment units across India",
    ctaText: "View All Products",
    ctaLink: "/shop",
    badge: "NMPL",
  },
];

const HeroSection = ({ isPreview = false }: HeroSectionProps) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isPlaying, setIsPlaying] = useState(true);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!isPreview && isPlaying) {
      const interval = setInterval(() => {
        setDirection(1);
        setCurrentImageIndex((prev) =>
          prev === sliderData.length - 1 ? 0 : prev + 1
        );
      }, 6000);

      return () => clearInterval(interval);
    }
  }, [isPreview, isPlaying]);

  const nextSlide = () => {
    setDirection(1);
    setCurrentImageIndex((prev) =>
      prev === sliderData.length - 1 ? 0 : prev + 1
    );
  };

  const prevSlide = () => {
    setDirection(-1);
    setCurrentImageIndex((prev) =>
      prev === 0 ? sliderData.length - 1 : prev - 1
    );
  };

  const goToSlide = (index: number) => {
    setDirection(index > currentImageIndex ? 1 : -1);
    setCurrentImageIndex(index);
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

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 80 : -80,
      opacity: 0,
      scale: 1.02,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -80 : 80,
      opacity: 0,
      scale: 0.98,
    }),
  };

  const currentSlide = sliderData[currentImageIndex];

  return (
    <section
      className={`relative w-full ${
        isPreview ? "scale-90 my-2" : "my-2 sm:my-4 lg:my-6"
      }`}
    >
      <div
        className="relative w-full overflow-hidden rounded-2xl shadow-2xl"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="aspect-[16/9] sm:aspect-[16/7] lg:aspect-[16/6] relative">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={currentImageIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                duration: 1.2,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="absolute inset-0 w-full h-full"
            >
              <Image
                src={currentSlide.image}
                alt={currentSlide.title}
                fill
                priority={currentImageIndex === 0}
                className="object-cover"
                sizes="100vw"
                unoptimized
              />

              {/* Gradient */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />

              {/* Content */}
              <div className="absolute inset-0 flex items-center">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="max-w-2xl text-white">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-6 text-xs font-semibold uppercase tracking-wider text-white" style={{ backgroundColor: 'var(--color-secondary)' }}>
                      <Shield size={13} />
                      <span>{currentSlide.badge}</span>
                    </div>

                    <h1 className="type-h1 font-bold mb-4 text-white" style={{ fontSize: 'clamp(1.75rem, 5vw, 3.5rem)' }}>
                      {currentSlide.title}
                    </h1>

                    <p className="type-body text-white/90 mb-8 max-w-lg" style={{ fontSize: 'clamp(1rem, 2vw, 1.25rem)' }}>
                      {currentSlide.subtitle}
                    </p>

                    <Link
                      href={currentSlide.ctaLink}
                      className="inline-flex items-center gap-3 text-white px-7 py-3.5 rounded-md font-semibold transition-all duration-300 hover:scale-105 shadow-lg text-sm uppercase tracking-wide"
                      style={{ backgroundColor: 'var(--color-secondary)' }}
                    >
                      {currentSlide.ctaText}
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Arrows */}
        <button
          onClick={prevSlide}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white p-3 rounded-full transition hover:scale-110 hidden sm:flex"
        >
          <ChevronLeft size={24} />
        </button>

        <button
          onClick={nextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white p-3 rounded-full transition hover:scale-110 hidden sm:flex"
        >
          <ChevronRight size={24} />
        </button>

        {/* Dots */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {sliderData.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-3 h-3 rounded-full transition ${
                index === currentImageIndex
                  ? "bg-white scale-125"
                  : "bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </div>

        {/* Play / Pause */}
        <button
          onClick={() => setIsPlaying((prev) => !prev)}
          className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white p-2 rounded-full transition hover:scale-110"
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
      </div>
    </section>
  );
};

export default HeroSection;
