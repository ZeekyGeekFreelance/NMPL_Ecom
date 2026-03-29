"use client";

import type { CSSProperties } from "react";

interface MiniSpinnerProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

const MiniSpinner: React.FC<MiniSpinnerProps> = ({
  size = 16,
  className,
  style,
}) => {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-2 border-solid border-[var(--color-primary-light)] border-t-[var(--color-primary)] ${className || ""}`}
      style={{
        width: size,
        height: size,
        ...style,
      }}
    />
  );
};

export default MiniSpinner;
