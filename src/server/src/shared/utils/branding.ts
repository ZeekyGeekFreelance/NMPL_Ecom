const DEFAULT_PLATFORM_NAME = "NMPL";
const DEFAULT_SUPPORT_EMAIL = "support@nmpl.local";

const firstNonEmpty = (values: Array<string | undefined | null>): string | null => {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

export const getPlatformName = (): string => {
  return firstNonEmpty([process.env.PLATFORM_NAME]) || DEFAULT_PLATFORM_NAME;
};

export const getSupportEmail = (): string => {
  const billingNotificationEmail = process.env.BILLING_NOTIFICATION_EMAILS
    ?.split(",")
    .map((email) => email.trim())
    .find(Boolean);

  return (
    firstNonEmpty([
      process.env.SUPPORT_EMAIL,
      billingNotificationEmail,
      process.env.EMAIL_USER,
    ]) || DEFAULT_SUPPORT_EMAIL
  );
};
