"use client";

interface SpokeSpinnerProps {
  size?: number;
  className?: string;
}

const SPOKE_COUNT = 12;

const SpokeSpinner: React.FC<SpokeSpinnerProps> = ({
  size = 56,
  className,
}) => {
  const spokeLength = Math.max(10, Math.round(size * 0.24));
  const spokeWidth = Math.max(4, Math.round(size * 0.12));

  return (
    <span
      aria-hidden="true"
      className={`relative inline-block animate-[spin_0.85s_linear_infinite] ${className || ""}`}
      style={{ width: size, height: size }}
    >
      {Array.from({ length: SPOKE_COUNT }).map((_, index) => (
        <span
          key={index}
          className="absolute inset-0"
          style={{ transform: `rotate(${index * (360 / SPOKE_COUNT)}deg)` }}
        >
          <span
            className="absolute left-1/2 top-0 -translate-x-1/2 rounded-full"
            style={{
              width: spokeWidth,
              height: spokeLength,
              backgroundColor: "var(--color-primary)",
              opacity: 0.14 + index * 0.07,
            }}
          />
        </span>
      ))}
    </span>
  );
};

export default SpokeSpinner;
