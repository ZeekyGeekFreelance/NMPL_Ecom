"use client";

import { useEffect } from "react";
import { normalizeHumanTextForField } from "@/app/lib/textNormalization";

const EXCLUDED_INPUT_TYPES = new Set([
  "email",
  "password",
  "url",
  "number",
  "tel",
  "date",
  "datetime-local",
  "time",
  "month",
  "week",
  "color",
  "range",
  "file",
  "hidden",
  "checkbox",
  "radio",
]);

const resolveFieldHint = (target: HTMLInputElement | HTMLTextAreaElement): string =>
  target.getAttribute("data-normalize-field") ||
  target.name ||
  target.id ||
  target.getAttribute("aria-label") ||
  target.getAttribute("placeholder") ||
  "";

const isTextEntryTarget = (
  target: EventTarget | null
): target is HTMLInputElement | HTMLTextAreaElement => {
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) {
    return false;
  }

  if (target.disabled || target.readOnly) {
    return false;
  }

  if (target.getAttribute("data-normalize") === "off") {
    return false;
  }

  if (target instanceof HTMLInputElement && EXCLUDED_INPUT_TYPES.has(target.type)) {
    return false;
  }

  return true;
};

const applyNormalizedValue = (target: HTMLInputElement | HTMLTextAreaElement) => {
  const currentValue = target.value;
  if (!currentValue) {
    return;
  }

  const nextValue = normalizeHumanTextForField(
    currentValue,
    resolveFieldHint(target),
    { typing: true }
  );
  if (nextValue === currentValue) {
    return;
  }

  const selectionStart = target.selectionStart;
  const selectionEnd = target.selectionEnd;
  const isCursorAtEnd =
    selectionStart !== null &&
    selectionEnd !== null &&
    selectionStart === currentValue.length &&
    selectionEnd === currentValue.length;

  target.value = nextValue;

  if (selectionStart === null || selectionEnd === null) {
    return;
  }

  if (isCursorAtEnd) {
    target.setSelectionRange(nextValue.length, nextValue.length);
    return;
  }

  const lengthDelta = nextValue.length - currentValue.length;
  const nextSelectionStart = Math.max(0, selectionStart + lengthDelta);
  const nextSelectionEnd = Math.max(0, selectionEnd + lengthDelta);
  target.setSelectionRange(nextSelectionStart, nextSelectionEnd);
};

const GlobalInputNormalizer = () => {
  useEffect(() => {
    const handleInputEvent = (event: Event) => {
      const inputEvent = event as InputEvent;
      if (inputEvent.isComposing) {
        return;
      }

      const { target } = event;
      if (!isTextEntryTarget(target)) {
        return;
      }

      applyNormalizedValue(target);
    };

    document.addEventListener("input", handleInputEvent, true);
    document.addEventListener("change", handleInputEvent, true);

    return () => {
      document.removeEventListener("input", handleInputEvent, true);
      document.removeEventListener("change", handleInputEvent, true);
    };
  }, []);

  return null;
};

export default GlobalInputNormalizer;
