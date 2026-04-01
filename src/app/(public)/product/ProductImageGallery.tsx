"use client";
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { generateProductPlaceholder } from "@/app/utils/placeholderImage";

interface ProductImageGalleryProps {
  images: string[];
  name: string;
  defaultImage: string;
}

const ProductImageGallery: React.FC<ProductImageGalleryProps> = ({
  images,
  name,
  defaultImage,
}) => {
  const [selectedImage, setSelectedImage] = useState(
    defaultImage || images[0] || generateProductPlaceholder(name)
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const thumbnailButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const nextImage =
      defaultImage || images[0] || generateProductPlaceholder(name);
    setSelectedImage(nextImage);
    setIsViewerOpen(false);
  }, [defaultImage, images, name]);

  useEffect(() => {
    const index = images.findIndex((img) => img === selectedImage);
    if (index !== -1) {
      setSelectedIndex(index);
    } else {
      setSelectedIndex(0);
    }
  }, [selectedImage, images]);

  useEffect(() => {
    const selectedThumb = thumbnailButtonRefs.current[selectedIndex];
    if (!selectedThumb) {
      return;
    }

    selectedThumb.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [selectedIndex]);

  const handleImageSelect = (img: string, index: number) => {
    setSelectedImage(img);
    setSelectedIndex(index);
  };

  const handlePrevImage = () => {
    const newIndex =
      selectedIndex === 0 ? images.length - 1 : selectedIndex - 1;
    setSelectedImage(images[newIndex] || defaultImage);
    setSelectedIndex(newIndex);
  };

  const handleNextImage = () => {
    const newIndex =
      selectedIndex === images.length - 1 ? 0 : selectedIndex + 1;
    setSelectedImage(images[newIndex] || defaultImage);
    setSelectedIndex(newIndex);
  };

  const handleOpenViewer = () => {
    setIsViewerOpen(true);
  };

  const handleCloseViewer = () => {
    setIsViewerOpen(false);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) {
      return;
    }
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) {
      return;
    }

    const touch = e.changedTouches[0];
    if (!touch) {
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const swipeThreshold = 40;

    if (Math.abs(deltaX) < swipeThreshold || Math.abs(deltaX) < Math.abs(deltaY)) {
      return;
    }

    if (deltaX > 0) {
      handlePrevImage();
      return;
    }

    handleNextImage();
  };

  if (images.length === 0) {
    return (
      <div className="relative bg-gray-50 rounded-2xl p-6 flex items-center justify-center h-[500px]">
        <Image
          src={generateProductPlaceholder(name)}
          alt={name}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-contain rounded-xl"
          priority
        />
      </div>
    );
  }

  const maxVisibleDots = 8;

  return (
    <>
    <div className="relative p-4 sm:p-6">
      <div className="flex flex-col gap-4">
        <div className="relative flex-1 min-h-0">
          <div className="absolute inset-y-0 left-2 sm:left-4 flex items-center z-10">
            <button
              onClick={handlePrevImage}
              className="bg-white/85 hover:bg-white rounded-full p-2 shadow-md transition-all transform hover:scale-105"
              aria-label="Previous image"
            >
              <ChevronLeft size={20} />
            </button>
          </div>

          <div className="absolute inset-y-0 right-2 sm:right-4 flex items-center z-10">
            <button
              onClick={handleNextImage}
              className="bg-white/85 hover:bg-white rounded-full p-2 shadow-md transition-all transform hover:scale-105"
              aria-label="Next image"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div
            className="relative flex items-center justify-center overflow-hidden rounded-2xl min-h-[360px] sm:min-h-[500px] bg-gray-50 px-6 py-4"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onClick={handleOpenViewer}
            style={{ cursor: "pointer" }}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleOpenViewer();
              }
            }}
            aria-label="Open image viewer"
          >
            <div
              className="relative overflow-hidden rounded-xl w-full h-[340px] sm:h-[460px]"
            >
              <Image
                src={selectedImage}
                alt={name}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-contain"
                priority
                onError={(e) => {
                  e.currentTarget.src = generateProductPlaceholder(name);
                }}
              />
            </div>
          </div>

          <div className="absolute bottom-4 left-4 bg-white/85 px-3 py-1 rounded-full text-sm text-gray-700 shadow-sm">
            {selectedIndex + 1} / {images.length || 1}
          </div>
        </div>

        <div>
          <div className="px-2">
            <div className="flex-1 overflow-x-auto">
              <div className="mx-auto flex min-w-max items-center justify-center gap-2 py-1 px-1">
                {images.map((img, index) => (
                  <button
                    key={`${img}-${index}`}
                    onClick={() => handleImageSelect(img, index)}
                    ref={(element) => {
                      thumbnailButtonRefs.current[index] = element;
                    }}
                    className={`relative border-2 rounded-xl p-1 transition-all duration-200 shrink-0 ${
                      selectedImage === img
                        ? "border-indigo-600 shadow-md"
                        : "border-gray-200 hover:border-indigo-400"
                    }`}
                    aria-label={`View image ${index + 1}`}
                  >
                    <div className="relative w-14 h-14 sm:w-16 sm:h-16">
                      <Image
                        src={img}
                        alt={`${name} thumbnail ${index + 1}`}
                        fill
                        sizes="64px"
                        className="rounded-lg object-cover"
                        priority={index < 2}
                        onError={(e) => {
                          e.currentTarget.src = generateProductPlaceholder(name);
                        }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-center gap-1.5">
            {images.slice(0, maxVisibleDots).map((_, index) => {
              const isActive = index === selectedIndex;
              return (
                <span
                  key={`dot-${index}`}
                  className={`inline-block rounded-full transition-all ${
                    isActive ? "w-3 h-3 bg-indigo-600" : "w-2 h-2 bg-gray-300"
                  }`}
                />
              );
            })}
          </div>

          {images.length > maxVisibleDots && (
            <p className="mt-1 text-center text-gray-400 text-sm tracking-[0.25em]">
              ...
            </p>
          )}
        </div>
      </div>
    </div>
    {isViewerOpen && (
      <div
        className="fixed inset-0 z-[120] bg-black/90 p-3 sm:p-8"
        onClick={handleCloseViewer}
      >
        <div
          className="relative mx-auto flex h-full w-full max-w-6xl items-center justify-center"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleCloseViewer}
            className="absolute right-2 top-2 z-30 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70"
            aria-label="Close image viewer"
          >
            <X size={22} />
          </button>
          <button
            type="button"
            onClick={handlePrevImage}
            className="absolute left-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70"
            aria-label="Previous image"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            onClick={handleNextImage}
            className="absolute right-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70"
            aria-label="Next image"
          >
            <ChevronRight size={22} />
          </button>
          <div className="relative h-full w-full">
            <Image
              src={selectedImage}
              alt={`${name} full view`}
              fill
              sizes="100vw"
              className="object-contain"
              priority
              onError={(event) => {
                event.currentTarget.src = generateProductPlaceholder(name);
              }}
            />
          </div>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
            {selectedIndex + 1} / {images.length || 1}
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default ProductImageGallery;
