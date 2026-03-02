import { config } from "@/config";
import prisma from "@/infra/database/database.config";
import { Prisma } from "@prisma/client";

const normalizeEmails = (emails: string[]): string[] => {
  const dedupe = new Set<string>();
  const normalized: string[] = [];

  for (const email of emails) {
    const trimmed = email.trim();
    if (!trimmed) {
      continue;
    }

    const lowered = trimmed.toLowerCase();
    if (dedupe.has(lowered)) {
      continue;
    }

    dedupe.add(lowered);
    normalized.push(trimmed);
  }

  return normalized;
};

export const parseBillingNotificationEmails = (
  raw: string | null | undefined
): string[] => {
  if (!raw) {
    return [];
  }

  return normalizeEmails(raw.split(","));
};

export const getEnvBillingNotificationEmails = (): string[] =>
  parseBillingNotificationEmails(config.branding.billingNotificationEmails);

const isBillingSupervisorColumnMissing = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return /isbillingsupervisor/i.test(error.message) &&
    /does not exist/i.test(error.message);
};

export const resolveBillingNotificationEmails = async (): Promise<{
  emails: string[];
  source: "USERS" | "ENV";
}> => {
  try {
    const billingUsers = await prisma.$queryRaw<Array<{ email: string }>>(
      Prisma.sql`
        SELECT "email"
        FROM "User"
        WHERE "isBillingSupervisor" = true
          AND "role" = 'ADMIN'
          AND "email" IS NOT NULL
          AND LENGTH(TRIM("email")) > 0
      `
    );

    const userEmails = normalizeEmails(
      billingUsers.map((row) => row.email || "")
    );
    if (userEmails.length > 0) {
      return {
        emails: userEmails,
        source: "USERS",
      };
    }
  } catch (error) {
    if (!isBillingSupervisorColumnMissing(error)) {
      throw error;
    }
  }

  return {
    emails: getEnvBillingNotificationEmails(),
    source: "ENV",
  };
};
