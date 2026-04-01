type ApiValidationError = {
  property?: string;
  constraints?: Record<string, string>;
};

export const getApiErrorMessage = (
  error: unknown,
  fallbackMessage = "An unexpected error occurred"
): string => {
  const defaultMessage = fallbackMessage;

  if (!error || typeof error !== "object") return defaultMessage;

  const maybeError = error as {
    data?: { message?: string; errors?: ApiValidationError[] };
    error?: string;
    message?: string;
  };

  const firstValidationError = maybeError.data?.errors?.[0];
  if (firstValidationError?.constraints) {
    const firstConstraint = Object.values(firstValidationError.constraints)[0];
    if (firstConstraint) return firstConstraint;
  }

  if (maybeError.data?.message) return maybeError.data.message;
  if (maybeError.error) return maybeError.error;
  if (maybeError.message) return maybeError.message;

  return defaultMessage;
};
