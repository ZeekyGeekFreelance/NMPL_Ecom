"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ShoppingBag, Package, Truck, Zap } from "lucide-react";
import { PLATFORM_NAME } from "@/app/lib/constants/config";
import SpokeSpinner from "@/app/components/feedback/SpokeSpinner";

const CustomLoader = () => {
  const loadingSteps = [
    { icon: ShoppingBag, text: "Preparing your experience", delay: 0 },
    { icon: Package, text: "Loading products", delay: 1 },
    { icon: Truck, text: "Setting up delivery", delay: 2 },
    { icon: Zap, text: "Almost ready", delay: 3 },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden" style={{ backgroundColor: 'var(--color-background)' }}>
      {/* Subtle industrial background geometry */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.06, scale: 1 }}
          transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
          className="absolute top-20 left-20 w-32 h-32 rounded-full"
          style={{ backgroundColor: 'var(--color-primary)' }}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.05, scale: 1 }}
          transition={{ duration: 2.5, repeat: Infinity, repeatType: "reverse", delay: 0.5 }}
          className="absolute bottom-20 right-20 w-24 h-24 rounded-full"
          style={{ backgroundColor: 'var(--color-secondary)' }}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.04, scale: 1 }}
          transition={{ duration: 3, repeat: Infinity, repeatType: "reverse", delay: 1 }}
          className="absolute top-1/2 left-10 w-16 h-16 rounded-full"
          style={{ backgroundColor: 'var(--color-primary-muted)' }}
        />
      </div>

      {/* Main loading content */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 text-center max-w-md w-full"
      >
        {/* Logo/Brand */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            duration: 0.5,
            delay: 0.2,
            type: "spring",
            stiffness: 200,
          }}
          className="mb-8"
        >
          <div className="relative">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 rounded-full opacity-10"
              style={{ backgroundColor: 'var(--color-primary)' }}
            />
            <div
              className="relative bg-white rounded-full p-3 shadow-lg inline-flex h-24 w-24 items-center justify-center"
              style={{ border: "1px solid var(--color-border)" }}
            >
              <div className="relative h-14 w-14">
                <Image
                  src="/images/branding/logo.jpg"
                  alt={`${PLATFORM_NAME} logo`}
                  fill
                  quality={100}
                  sizes="56px"
                  className="object-contain"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Loading spinner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mb-8"
        >
          <div className="relative inline-flex items-center justify-center">
            <motion.div
              animate={{ scale: [0.94, 1.08, 0.94] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              className="absolute inset-0 rounded-full"
              style={{ backgroundColor: "rgba(29, 52, 97, 0.06)" }}
            />
            <SpokeSpinner size={68} />
          </div>
        </motion.div>

        {/* Loading text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mb-6"
        >
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Welcome to {PLATFORM_NAME}
          </h2>
          <p className="text-gray-600">
            We&apos;re getting everything ready for you
          </p>
        </motion.div>

        {/* Loading steps */}
        <div className="space-y-3">
          {loadingSteps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.8 + step.delay * 0.2 }}
              className="flex items-center gap-3 bg-white rounded-lg p-3 shadow-sm"
              style={{ border: '1px solid var(--color-border)' }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-light)' }}>
                <step.icon className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
              </div>
              <span className="text-sm font-medium text-gray-700">
                {step.text}
              </span>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 1 + step.delay * 0.2 }}
                className="ml-auto"
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-secondary)' }} />
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* Progress bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.5 }}
          className="mt-8"
        >
          <div className="bg-white rounded-xl p-4 shadow-sm" style={{ border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Loading progress
              </span>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 2 }}
                className="text-sm font-semibold"
                style={{ color: 'var(--color-primary)' }}
              >
                85%
              </motion.span>
            </div>
            <div className="w-full rounded-full h-2" style={{ backgroundColor: 'var(--color-border)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "85%" }}
                transition={{ duration: 2, delay: 1.5 }}
                className="h-2 rounded-full"
                style={{ backgroundColor: 'var(--color-primary)' }}
              />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default CustomLoader;
