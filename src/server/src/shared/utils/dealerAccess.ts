import { Prisma, PrismaClient } from "@prisma/client";

export const isDealerTableMissing = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes('relation "DealerProfile" does not exist') ||
    error.message.includes('relation "DealerPriceMapping" does not exist')
  );
};

export const getDealerPriceMap = async (
  prisma: PrismaClient,
  userId: string | undefined,
  variantIds: string[]
): Promise<Map<string, number>> => {
  if (!userId || !variantIds.length) {
    return new Map();
  }

  try {
    const dealerProfileRows = await prisma.$queryRaw<
      Array<{ status: string }>
    >(
      Prisma.sql`
        SELECT "status"
        FROM "DealerProfile"
        WHERE "userId" = ${userId}
        LIMIT 1
      `
    );

    if (!dealerProfileRows.length || dealerProfileRows[0].status !== "APPROVED") {
      return new Map();
    }

    const priceRows = await prisma.$queryRaw<
      Array<{ variantId: string; customPrice: number }>
    >(
      Prisma.sql`
        SELECT "variantId", "customPrice"
        FROM "DealerPriceMapping"
        WHERE "dealerId" = ${userId}
          AND "variantId" IN (${Prisma.join(variantIds)})
      `
    );

    return new Map(priceRows.map((row) => [row.variantId, row.customPrice]));
  } catch (error) {
    if (isDealerTableMissing(error)) {
      return new Map();
    }

    throw error;
  }
};
