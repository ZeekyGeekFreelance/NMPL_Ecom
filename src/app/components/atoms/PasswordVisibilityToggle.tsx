"use client";

import { Eye, EyeOff } from "lucide-react";

interface PasswordVisibilityToggleProps {
  visible: boolean;
  onToggle: () => void;
  className?: string;
  coverClassName?: string;
  size?: number;
}

const PasswordVisibilityToggle = ({
  visible,
  onToggle,
  className = "",
  coverClassName = "",
  size = 18,
}: PasswordVisibilityToggleProps) => {
  return (
    <div
      className={`absolute inset-y-0 right-0 z-20 flex items-center justify-end pl-6 pr-2 ${coverClassName}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`relative z-10 rounded-sm bg-white/95 p-0.5 backdrop-blur-[1px] ${className}`}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? <EyeOff size={size} /> : <Eye size={size} />}
      </button>
    </div>
  );
};

export default PasswordVisibilityToggle;
