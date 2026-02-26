"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Loader2, X } from "lucide-react";

interface DropdownOption {
  label: string;
  value: string;
}

interface DropdownProps {
  label?: string;
  options: DropdownOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  className?: string;
  disabled?: boolean;
  isLoading?: boolean;
}

const Dropdown: React.FC<DropdownProps> = ({
  label,
  options,
  value,
  onChange,
  className,
  disabled,
  isLoading,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownWidth, setDropdownWidth] = useState<number | null>(null);

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (buttonRef.current) {
      setDropdownWidth(buttonRef.current.offsetWidth);
    }
  }, [isOpen]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, []);

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setIsOpen(false);
  };

  const selectedLabel =
    options.find((opt) => opt.value === value)?.label || label || "Select...";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        ref={buttonRef}
        className={`flex h-11 items-center justify-between px-3.5
          rounded-lg bg-white border border-gray-200
          transition-all duration-200
          ${
            disabled
              ? "cursor-not-allowed opacity-60"
              : "cursor-pointer hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
          } ${className || ""}`}
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev);
          }
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={label || "Select option"}
      >
        <span className="text-sm font-medium text-gray-700 truncate">
          {isLoading ? "Loading..." : selectedLabel}
        </span>

        <div className="flex items-center">
          {isLoading ? (
            <Loader2 size={16} className="animate-spin text-gray-400 ml-2" />
          ) : value && !disabled ? (
            <X
              size={16}
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200 ml-2"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
            />
          ) : (
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <ChevronDown size={16} className="text-gray-400 ml-2" />
            </motion.div>
          )}
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.1 }}
            className="absolute z-40 mt-1 overflow-hidden rounded-lg border border-gray-100 bg-white shadow-lg"
            style={{ width: dropdownWidth || "auto" }}
          >
            <ul className="max-h-60 overflow-auto py-1" role="listbox">
              {options.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === option.value}
                    className={`w-full px-3 py-2 text-left text-sm transition-colors duration-150
                      hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none
                      ${
                        value === option.value
                          ? "bg-blue-50 text-blue-600"
                          : "text-gray-700"
                      }`}
                    onClick={() => handleSelect(option.value)}
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dropdown;
