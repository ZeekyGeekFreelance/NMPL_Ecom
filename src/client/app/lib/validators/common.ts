import { z } from "zod";

export const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

export const sanitizeTextInput = (value: string): string =>
  normalizeWhitespace(value.replace(/[<>`]/g, ""));

export const sanitizeLooseTextInput = (value: string): string =>
  value.replace(/[<>`]/g, "");

export const normalizeEmailValue = (value: string): string =>
  normalizeWhitespace(value).toLowerCase();

export const normalizePhoneDigits = (value: string, maxLength = 10): string =>
  value.replace(/\D/g, "").slice(0, maxLength);

const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .max(254, "Email address is too long.");

export const validateEmailValue = (value: string): true | string => {
  const result = emailSchema.safeParse(value);
  return result.success ? true : result.error.errors[0]?.message || "Invalid email.";
};

export const validateDisplayName = (
  value: string,
  minLength = 2,
  maxLength = 120,
  fieldLabel = "Name"
): true | string => {
  const normalized = sanitizeTextInput(value);

  if (!normalized) {
    return `${fieldLabel} is required.`;
  }
  if (normalized.length < minLength || normalized.length > maxLength) {
    return `${fieldLabel} must be between ${minLength} and ${maxLength} characters.`;
  }

  return true;
};

export const validateBusinessName = (value: string): true | string =>
  validateDisplayName(value, 2, 120, "Business name");

export const validateTenDigitPhone = (
  value: string,
  fieldLabel = "Phone number"
): true | string => {
  const normalized = normalizePhoneDigits(value, 10);

  if (!normalized) {
    return `${fieldLabel} is required.`;
  }
  if (!/^\d{10}$/.test(normalized)) {
    return `${fieldLabel} must be exactly 10 digits.`;
  }

  return true;
};

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long.")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
  .regex(/[0-9]/, "Password must contain at least one number.")
  .regex(
    /[!@#$%^&*(),.?":{}|<>]/,
    "Password must contain at least one special character."
  );

export const validatePasswordPolicy = (value: string): true | string => {
  const result = passwordSchema.safeParse(value);
  return result.success
    ? true
    : result.error.errors[0]?.message || "Password does not meet policy requirements.";
};

export const hasValidationError = (result: true | string): result is string =>
  result !== true;
