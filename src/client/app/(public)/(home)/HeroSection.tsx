"use client";

import SliderImg1 from "@/app/assets/images/laptop-slider.jpg";
import SliderImg2 from "@/app/assets/images/furniture-slider.jpeg";
import SliderImg3 from "@/app/assets/images/shirt-slider.jpg";
import SliderImg4 from "@/app/assets/images/shoes-slider.jpeg";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef, type TouchEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  ShoppingBag,
  Star,
} from "lucide-react";
import Link from "next/link";

interface HeroSectionProps {
  isPreview?: boolean;
}

const sliderData = [
  {
    image: SliderImg1,
    title: "Discover Amazing Deals",
    subtitle: "Up to 70% off on selected items",
    ctaText: "Shop Now",
    ctaLink: "/shop",
    badge: "New Arrivals",
  },
  {
    image: SliderImg2,
    title: "Premium Quality Products",
    subtitle: "Handpicked items for your lifestyle",
    ctaText: "Explore",
    ctaLink: "/shop",
    badge: "Featured",
  },
  {
    image: SliderImg3,
    title: "Fast & Free Shipping",
    subtitle: "On orders over ₹50",
    ctaText: "Learn More",
    ctaLink: "/shop",
    badge: "Limited Time",
  },
  {
    image: SliderImg4,
    title: "Trending Now",
    subtitle: "Upgrade your style today",
    ctaText: "Discover",
    ctaLink: "/shop",
    badge: "Hot Picks",
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
              />

              {/* Gradient */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />

              {/* Content */}
              <div className="absolute inset-0 flex items-center">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="max-w-2xl text-white">
                    <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6 border border-white/30">
                      <Star size={16} className="text-yellow-400" />
                      <span className="text-sm font-medium">
                        {currentSlide.badge}
                      </span>
                    </div>

                    <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold mb-4 leading-tight">
                      {currentSlide.title}
                    </h1>

                    <p className="text-lg sm:text-xl text-white/90 mb-8 max-w-lg">
                      {currentSlide.subtitle}
                    </p>

                    <Link
                      href={currentSlide.ctaLink}
                      className="inline-flex items-center gap-3 bg-white text-gray-900 px-8 py-4 rounded-full font-semibold hover:bg-gray-100 transition-transform duration-300 hover:scale-105 shadow-lg"
                    >
                      <ShoppingBag size={18} />
                      {currentSlide.ctaText}
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
