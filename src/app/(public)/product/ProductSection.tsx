"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Package } from "lucide-react";

import ProductCard from "./ProductCard";
import { Product } from "@/app/types/productTypes";
import { runtimeEnv } from "@/app/lib/runtimeEnv";

interface ProductSectionProps {
  title: string;
  products: Product[];
  loading: boolean;
  error?: Error | unknown;
  showTitle?: boolean;
}

const AUTOPLAY_INTERVAL_MS = 4500;

const getItemsPerSlide = (width: number) => {
  if (width >= 1536) return 3;
  if (width >= 1280) return 4;
  if (width >= 1024) return 3;
  if (width >= 640) return 2;
  return 1;
};

const buildPaginationGuide = (totalSlides: number, currentSlide: number) => {
  if (totalSlides <= 7) {
    return Array.from({ length: totalSlides }, (_, index) => index);
  }

  const importantIndices = new Set<number>([
    0,
    totalSlides - 1,
    currentSlide - 1,
    currentSlide,
    currentSlide + 1,
  ]);

  const sortedIndices = Array.from(importantIndices)
    .filter((index) => index >= 0 && index < totalSlides)
    .sort((left, right) => left - right);

  const guide: Array<number | "ellipsis"> = [];
  sortedIndices.forEach((index, itemIndex) => {
    if (itemIndex > 0 && index - sortedIndices[itemIndex - 1] > 1) {
      guide.push("ellipsis");
    }
    guide.push(index);
  });

  return guide;
};

const ProductSection: React.FC<ProductSectionProps> = ({
  title,
  products,
  error,
  showTitle = false,
}) => {
  const [itemsPerSlide, setItemsPerSlide] = useState(1);
  const [currentSlide, setCurrentSlide] = useState(0);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const syncItemsPerSlide = () => {
      setItemsPerSlide(getItemsPerSlide(window.innerWidth));
    };

    syncItemsPerSlide();
    window.addEventListener("resize", syncItemsPerSlide);

    return () => window.removeEventListener("resize", syncItemsPerSlide);
  }, []);

  const slides = useMemo(() => {
    const nextSlides: Product[][] = [];
    for (let index = 0; index < products.length; index += itemsPerSlide) {
      nextSlides.push(products.slice(index, index + itemsPerSlide));
    }
    return nextSlides;
  }, [products, itemsPerSlide]);

  const totalSlides = slides.length;

  useEffect(() => {
    setCurrentSlide(0);
  }, [title, totalSlides]);

  useEffect(() => {
    if (totalSlides <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setCurrentSlide((previous) => (previous + 1) % totalSlides);
    }, AUTOPLAY_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [totalSlides]);

  const paginationGuide = useMemo(
    () => buildPaginationGuide(totalSlides, currentSlide),
    [totalSlides, currentSlide]
  );

  const goToNextSlide = () => {
    setCurrentSlide((previous) => (previous + 1) % totalSlides);
  };

  const goToPreviousSlide = () => {
    setCurrentSlide((previous) => (previous === 0 ? totalSlides - 1 : previous - 1));
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (totalSlides <= 1) {
      swipeStartRef.current = null;
      return;
    }

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
      goToPreviousSlide();
      return;
    }

    goToNextSlide();
  };

  if (error && products.length === 0) {
    const friendlyErrorMessage =
      "We couldn't load products right now. Please refresh and try again.";

    return (
      <section className="py-8 sm:py-12 lg:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-md mx-auto">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package size={32} className="text-red-500" />
              </div>
              <h3 className="text-xl font-semibold text-red-700 mb-2">
                Error loading {title.toLowerCase()}
              </h3>
              <p className="text-red-600 text-sm">{friendlyErrorMessage}</p>
              {!runtimeEnv.isProduction && (
                <p className="text-red-500 text-xs mt-2">{(error as any)?.message ?? String(error)}</p>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!products.length) {
    return (
      <section className="py-8 sm:py-12 lg:py-16 ">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package size={32} className="text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No {title.toLowerCase()} available
              </h3>
              <p className="text-gray-600 text-sm">
                Check back soon for new products!
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8 sm:py-12 lg:py-16 ">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {showTitle && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="type-h3 text-gray-900 capitalize">
                {title}
              </h2>
              {products.length > 8 && (
                <button
                  className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 sm:px-6 py-2 sm:py-3
                 rounded-sm font-semibold
                  self-start sm:self-auto text-sm"
                >
                  View All
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              )}
            </div>
          </motion.div>
        )}

        <div
          className="overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <motion.div
            className="flex"
            animate={{ x: `-${currentSlide * 100}%` }}
            transition={{ duration: 0.55, ease: "easeInOut" }}
          >
            {slides.map((slideProducts, slideIndex) => (
              <div key={`${title}-slide-${slideIndex}`} className="w-full shrink-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-3 gap-4 sm:gap-4">
                  {slideProducts.map((product) => (
                    <div key={product.id}>
                      <ProductCard product={product} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {totalSlides > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            {paginationGuide.map((guideItem, index) => {
              if (guideItem === "ellipsis") {
                return (
                  <span
                    key={`${title}-ellipsis-${index}`}
                    className="px-1 text-xs font-semibold tracking-[0.2em] text-gray-400"
                  >
                    ...
                  </span>
                );
              }

              const isActive = guideItem === currentSlide;
              return (
                <button
                  key={`${title}-dot-${guideItem}`}
                  type="button"
                  aria-label={`Go to slide ${guideItem + 1}`}
                  onClick={() => setCurrentSlide(guideItem)}
                  className={`h-2.5 rounded-full transition-all duration-200 ${isActive
                      ? "w-7 bg-indigo-600"
                      : "w-2.5 bg-gray-300 hover:bg-gray-400"
                    }`}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default React.memo(ProductSection);
