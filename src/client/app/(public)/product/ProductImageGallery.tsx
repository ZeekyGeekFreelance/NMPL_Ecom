"use client";
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  Maximize2,
  Minimize2,
} from "lucide-react";
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
  const [isZoomed, setIsZoomed] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const galleryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nextImage = defaultImage || images[0] || generateProductPlaceholder(name);
    setSelectedImage(nextImage);
    setIsZoomed(false);
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
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullScreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
    };
  }, []);

  const handleImageSelect = (img: string, index: number) => {
    setSelectedImage(img);
    setSelectedIndex(index);
    setIsZoomed(false);
  };

  const handlePrevImage = () => {
    const newIndex =
      selectedIndex === 0 ? images.length - 1 : selectedIndex - 1;
    setSelectedImage(images[newIndex] || defaultImage);
    setSelectedIndex(newIndex);
    setIsZoomed(false);
  };

  const handleNextImage = () => {
    const newIndex =
      selectedIndex === images.length - 1 ? 0 : selectedIndex + 1;
    setSelectedImage(images[newIndex] || defaultImage);
    setSelectedIndex(newIndex);
    setIsZoomed(false);
  };

  const handleZoomToggle = () => {
    setIsZoomed((previous) => !previous);
  };

  const handleFullScreenToggle = async () => {
    if (!galleryRef.current) return;

    if (!isFullScreen) {
      try {
        await galleryRef.current.requestFullscreen();
        setIsFullScreen(true);
      } catch (err) {
        console.error("Failed to enter fullscreen:", err);
      }
    } else {
      try {
        await document.exitFullscreen();
        setIsFullScreen(false);
      } catch (err) {
        console.error("Failed to exit fullscreen:", err);
      }
    }

    setIsZoomed(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isZoomed) return;

    const { left, top, width, height } =
      e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;

    setMousePosition({ x, y });
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
    <div
      ref={galleryRef}
      className={`relative ${
        isFullScreen ? "bg-black h-screen w-screen p-3 sm:p-6" : "p-4 sm:p-6"
      }`}
    >
      <button
        onClick={handleFullScreenToggle}
        className="absolute top-4 right-4 z-20 rounded-full p-2 bg-white/85 shadow-md hover:bg-gray-100"
        aria-label={isFullScreen ? "Exit fullscreen" : "View fullscreen"}
      >
        {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
      </button>

      <div
        className={`flex flex-col gap-4 ${
          isFullScreen ? "h-full max-w-6xl mx-auto" : ""
        }`}
      >
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

          <div className="absolute top-4 right-16 flex gap-2 z-10">
            <button
              onClick={handleZoomToggle}
              className={`bg-white/85 rounded-full p-2 shadow-md transition-all ${
                isZoomed ? "bg-indigo-100 text-indigo-600" : "hover:bg-gray-100"
              }`}
              aria-label={isZoomed ? "Exit zoom" : "Zoom image"}
            >
              <ZoomIn size={20} />
            </button>
          </div>

          <div
            className={`flex items-center justify-center overflow-hidden rounded-2xl ${
              isFullScreen
                ? "h-full bg-black"
                : "min-h-[360px] sm:min-h-[500px] bg-gray-50 px-6 py-4"
            }`}
            onMouseMove={handleMouseMove}
            style={{ cursor: isZoomed ? "zoom-out" : "zoom-in" }}
            onClick={handleZoomToggle}
          >
            <div
              className={`relative overflow-hidden rounded-xl w-full ${
                isFullScreen ? "h-full max-h-full" : "h-[340px] sm:h-[460px]"
              }`}
            >
              <Image
                src={selectedImage}
                alt={name}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className={`object-contain transition-all duration-300 ${
                  isZoomed ? "scale-150" : "scale-100"
                }`}
                style={
                  isZoomed
                    ? {
                        transformOrigin: `${mousePosition.x}% ${mousePosition.y}%`,
                        objectPosition: "center",
                      }
                    : {}
                }
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

        <div className={`${isFullScreen ? "pb-2" : ""}`}>
          <div className="flex items-center justify-center gap-3 px-2">
            <button
              onClick={handlePrevImage}
              className="shrink-0 rounded-full border border-gray-300 bg-white p-1.5 text-gray-700 hover:bg-gray-50"
              aria-label="Previous thumbnail"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex-1 overflow-x-auto">
              <div className="mx-auto flex min-w-max items-center justify-center gap-2 py-1 px-1">
                {images.map((img, index) => (
                  <button
                    key={`${img}-${index}`}
                    onClick={() => handleImageSelect(img, index)}
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

            <button
              onClick={handleNextImage}
              className="shrink-0 rounded-full border border-gray-300 bg-white p-1.5 text-gray-700 hover:bg-gray-50"
              aria-label="Next thumbnail"
            >
              <ChevronRight size={16} />
            </button>
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
  );
};

export default ProductImageGallery;
