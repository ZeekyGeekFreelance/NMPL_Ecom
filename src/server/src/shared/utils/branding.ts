import { config } from "@/config";

export const getPlatformName = (): string => config.branding.platformName;

export const getBillingNotificationEmails = (): string[] => {
  const emails = config.branding.billingNotificationEmails
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const uniqueEmails: string[] = [];

  for (const email of emails) {
    const normalizedEmail = email.toLowerCase();
    if (seen.has(normalizedEmail)) {
      continue;
    }
    seen.add(normalizedEmail);
    uniqueEmails.push(email);
  }

  return uniqueEmails;
};

export const getSupportEmail = (): string => {
  const billingNotificationEmail = getBillingNotificationEmails()[0];

  return billingNotificationEmail || config.branding.supportEmail;
};
