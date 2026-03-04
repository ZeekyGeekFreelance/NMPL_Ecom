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

/**
 * Resolves effective dealer prices for a batch of variants in a single query.
 *
 * Strategy:
 *  1. Verify the user has an APPROVED or LEGACY dealer profile — O(1) indexed lookup.
 *  2. Use a single LEFT JOIN between ProductVariant and DealerPriceMapping.
 *  3. COALESCE: customPrice (per-dealer override) → defaultDealerPrice (platform default).
 *  4. Variants with no resolved price are excluded from the returned map.
 *
 * No separate mapping query. No N+1. No table scans.
 */
export const getDealerPriceMap = async (
  prisma: PrismaClient,
  userId: string | undefined,
  variantIds: string[]
): Promise<Map<string, number>> => {
  if (!userId || !variantIds.length) {
    return new Map();
  }

  try {
    // First check dealer eligibility with a single indexed lookup.
    // Returns empty map immediately for guests, regular users, and ineligible dealers —
    // this prevents the price-resolution query from running unnecessarily and
    // ensures non-dealer product fetches are never affected.
    const dealerRows = await prisma.$queryRaw<Array<{ status: string }>>(
      Prisma.sql`
        SELECT "status"
        FROM "DealerProfile"
        WHERE "userId" = ${userId}
        LIMIT 1
      `
    );

    if (
      !dealerRows.length ||
      (dealerRows[0].status !== "APPROVED" && dealerRows[0].status !== "LEGACY")
    ) {
      return new Map();
    }

    // Dealer is eligible — resolve prices via single LEFT JOIN + COALESCE.
    const rows = await prisma.$queryRaw<
      Array<{ variantId: string; resolvedPrice: number }>
    >(
      Prisma.sql`
        SELECT
          pv."id"                                             AS "variantId",
          COALESCE(m."customPrice", pv."defaultDealerPrice")  AS "resolvedPrice"
        FROM "ProductVariant" pv
        LEFT JOIN "DealerPriceMapping" m
          ON m."variantId" = pv."id"
         AND m."dealerId"  = ${userId}
        WHERE pv."id" IN (${Prisma.join(variantIds)})
          AND COALESCE(m."customPrice", pv."defaultDealerPrice") IS NOT NULL
      `
    );

    return new Map(rows.map((row) => [row.variantId, Number(row.resolvedPrice)]));
  } catch (error) {
    if (isDealerTableMissing(error)) {
      return new Map();
    }

    throw error;
  }
};
