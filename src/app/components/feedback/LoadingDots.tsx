"use client";

import { motion } from "framer-motion";

interface LoadingDotsProps {
  label?: string;
  className?: string;
  align?: "left" | "center";
}

const DOT_TRANSITION = {
  duration: 0.7,
  repeat: Infinity,
  repeatType: "reverse" as const,
};

const LoadingDots: React.FC<LoadingDotsProps> = ({
  label = "Loading",
  className,
  align = "left",
}) => {
  return (
    <span
      className={`inline-flex items-center gap-1 text-sm font-medium text-gray-600 ${
        align === "center" ? "justify-center" : ""
      } ${className || ""}`}
      aria-live="polite"
    >
      <span>{label}</span>
      <span className="inline-flex items-center gap-1">
        {[0, 1, 2].map((dotIndex) => (
          <motion.span
            key={dotIndex}
            initial={{ opacity: 0.25, y: 0 }}
            animate={{ opacity: 1, y: [-1, 1, -1] }}
            transition={{
              ...DOT_TRANSITION,
              delay: dotIndex * 0.16,
            }}
            className="text-[var(--color-primary)]"
          >
            .
          </motion.span>
        ))}
      </span>
    </span>
  );
};

export default LoadingDots;
