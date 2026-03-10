"use client";

import { useState } from "react";
import { Controller } from "react-hook-form";
import { Eye, EyeClosed, LucideIcon } from "lucide-react";
import {
  normalizeHumanTextForField,
  toTitleCaseWordsForTyping,
} from "@/app/lib/textNormalization";
interface InputProps {
  label?: string;
  control: any;
  name: string;
  type?: string;
  placeholder?: string;
  validation?: object;
  icon?: LucideIcon;
  className?: string;
  error?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  normalizeMode?: "auto" | "off" | "title";
  normalizeFieldHint?: string;
}

const Input: React.FC<InputProps> = ({
  control,
  label,
  name,
  type = "text",
  placeholder,
  validation = {},
  icon: Icon,
  className = "",
  error,
  onChange,
  onBlur,
  normalizeMode = "auto",
  normalizeFieldHint,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordField = type === "password";
  const resolvedType = isPasswordField && showPassword ? "text" : type;

  return (
    <div className="w-full">
      {label && <label className="text-gray-700 font-medium">{label}</label>}

      <Controller
        name={name}
        control={control}
        rules={validation}
        render={({ field, fieldState }) => {
          const resolvedError = error || fieldState.error?.message;
          const supportsTextNormalization = type === "text" || type === "search";
          const fieldHint = normalizeFieldHint || name || label || placeholder || "";

          const normalizeValueForField = (value: string): string => {
            if (!supportsTextNormalization || normalizeMode === "off") {
              return value;
            }

            return normalizeMode === "title"
              ? toTitleCaseWordsForTyping(value)
              : normalizeHumanTextForField(value, fieldHint, { typing: true });
          };

          return (
            <>
              <div className="relative mt-[6px]">
                <input
                  {...field}
                  type={resolvedType}
                  placeholder={placeholder}
                  aria-invalid={Boolean(resolvedError)}
                  className={`p-[14px] pl-3 pr-10 w-full border-b-2 text-gray-800 placeholder:text-gray-600 ${
                    resolvedError
                      ? "border-red-500 bg-red-50/40 focus:border-red-500"
                      : "border-gray-300 focus:border-gray-700"
                  } focus:outline-none ${className}`}
                  onChange={(e) => {
                    const nextValue = normalizeValueForField(e.target.value);

                    if (nextValue !== e.target.value) {
                      e.target.value = nextValue;
                    }

                    field.onChange(nextValue);
                    if (onChange) onChange(e);
                  }}
                  onKeyUp={(event) => {
                    if (event.key !== "Backspace" && event.key !== "Delete") {
                      return;
                    }

                    const nextValue = normalizeValueForField(event.currentTarget.value);
                    if (nextValue !== event.currentTarget.value) {
                      event.currentTarget.value = nextValue;
                    }

                    // Ensure deletion-only edits are always reflected in form dirty state.
                    field.onChange(nextValue);
                  }}
                  onBlur={(e) => {
                    field.onBlur();
                    if (onBlur) onBlur(e);
                  }}
                />

                {isPasswordField ? (
                  <button
                    type="button"
                    onClick={() => setShowPassword((previous) => !previous)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-800"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <Eye className="h-[20px] w-[20px]" />
                    ) : (
                      <EyeClosed className="h-[20px] w-[20px]" />
                    )}
                  </button>
                ) : null}

                {Icon && !isPasswordField && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Icon className="w-[22px] h-[22px] text-gray-800" />
                  </div>
                )}
              </div>
              {resolvedError ? (
                <p className="text-red-500 text-sm mt-1">{resolvedError}</p>
              ) : null}
            </>
          );
        }}
      />
    </div>
  );
};

export default Input;
