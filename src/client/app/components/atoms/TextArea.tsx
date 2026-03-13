"use client";

import React from "react";
import { Controller } from "react-hook-form";
import { LucideIcon } from "lucide-react";
import {
  normalizeHumanTextForField,
  toTitleCaseWordsForTyping,
} from "@/app/lib/textNormalization";

interface TextAreaProps {
  label?: string;
  control: any;
  rows?: number;
  cols?: number;
  name: string;
  placeholder?: string;
  validation?: object;
  icon?: LucideIcon;
  className?: string;
  error?: string;
  normalizeMode?: "auto" | "off" | "title";
  normalizeFieldHint?: string;
}

const TextArea: React.FC<TextAreaProps> = ({
  control,
  label,
  name,
  rows = 2,
  cols = 20,
  placeholder,
  validation = {},
  icon: Icon,
  className = "",
  error,
  normalizeMode = "auto",
  normalizeFieldHint,
}) => {
  return (
    <div className="relative w-full">
      {label && (
        <label className="text-gray-700 pb-2 font-medium">{label}</label>
      )}

      <Controller
        name={name}
        control={control}
        rules={validation}
        render={({ field }) => {
          const fieldHint =
            normalizeFieldHint || name || label || placeholder || "";

          const normalizeValueForField = (value: string): string => {
            if (normalizeMode === "off") {
              return value;
            }

            return normalizeMode === "title"
              ? toTitleCaseWordsForTyping(value)
              : normalizeHumanTextForField(value, fieldHint, { typing: true });
          };

          return (
            <textarea
              {...field}
              placeholder={placeholder}
              className={`p-[14px] pl-3 pr-10 w-full border border-gray-300 text-gray-800 placeholder:text-black 
                rounded focus:outline-none focus:ring-[2px] focus:ring-lime-700 resize-none ${className}`}
              rows={rows}
              cols={cols}
              onChange={(event) => {
                const nextValue = normalizeValueForField(event.target.value);

                if (nextValue !== event.target.value) {
                  event.target.value = nextValue;
                }

                field.onChange(nextValue);
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
            />
          );
        }}
      />

      {Icon && (
        <div className="absolute top-3 right-3">
          <Icon className="w-[22px] h-[22px] text-gray-800" />
        </div>
      )}

      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
};

export default TextArea;
