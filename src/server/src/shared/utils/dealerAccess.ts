import { Prisma } from "@prisma/client";
import type prismaClient from "@/infra/database/database.config";
import { buildPublicVariantSignature } from "@/shared/utils/publicVariantGrouping";

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
 * Resolves effective dealer prices for a batch of variants.
 *
 * Dealer pricing is normalized by buyer-visible variant signature so legacy
 * duplicate rows with identical public attributes cannot disagree on price
 * across catalog, detail, cart, and order flows.
 */
export const getDealerPriceMap = async (
  prisma: typeof prismaClient,
  userId: string | undefined,
  variantIds: string[]
): Promise<Map<string, number>> => {
  if (!userId || !variantIds.length) {
    return new Map();
  }

  try {
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

    const requestedVariants = await prisma.productVariant.findMany({
      where: {
        id: {
          in: variantIds,
        },
      },
      select: {
        id: true,
        productId: true,
        attributes: {
          select: {
            attribute: {
              select: {
                name: true,
              },
            },
            value: {
              select: {
                value: true,
              },
            },
          },
        },
      },
    });

    if (!requestedVariants.length) {
      return new Map();
    }

    const productIds = Array.from(
      new Set(requestedVariants.map((variant) => variant.productId))
    );

    const candidateVariants = await prisma.productVariant.findMany({
      where: {
        productId: {
          in: productIds,
        },
      },
      select: {
        id: true,
        productId: true,
        attributes: {
          select: {
            attribute: {
              select: {
                name: true,
              },
            },
            value: {
              select: {
                value: true,
              },
            },
          },
        },
      },
    });

    if (!candidateVariants.length) {
      return new Map();
    }

    const candidateVariantIds = candidateVariants.map((variant) => variant.id);
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
        WHERE pv."id" IN (${Prisma.join(candidateVariantIds)})
          AND COALESCE(m."customPrice", pv."defaultDealerPrice") IS NOT NULL
      `
    );

    if (!rows.length) {
      return new Map();
    }

    const rawDealerPriceByVariantId = new Map(
      rows.map((row) => [row.variantId, Number(row.resolvedPrice)])
    );
    const lowestDealerPriceByVisibleGroup = new Map<string, number>();

    for (const variant of candidateVariants) {
      const resolvedPrice = rawDealerPriceByVariantId.get(variant.id);
      if (resolvedPrice === undefined) {
        continue;
      }

      const visibleGroupKey = `${variant.productId}::${buildPublicVariantSignature(
        variant
      )}`;
      const existingPrice = lowestDealerPriceByVisibleGroup.get(visibleGroupKey);

      if (existingPrice === undefined || resolvedPrice < existingPrice) {
        lowestDealerPriceByVisibleGroup.set(visibleGroupKey, resolvedPrice);
      }
    }

    return new Map(
      requestedVariants.flatMap((variant) => {
        const visibleGroupKey = `${variant.productId}::${buildPublicVariantSignature(
          variant
        )}`;
        const resolvedPrice =
          lowestDealerPriceByVisibleGroup.get(visibleGroupKey);

        return resolvedPrice === undefined
          ? []
          : [[variant.id, resolvedPrice] as const];
      })
    );
  } catch (error) {
    if (isDealerTableMissing(error)) {
      return new Map();
    }

    throw error;
  }
};
