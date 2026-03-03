import { PrismaClient } from "@prisma/client";
import { RequestBatchLoader } from "@/shared/utils/RequestBatchLoader";

const toProductIdMap = <T extends { productId: string }>(rows: T[]) => {
  const map = new Map<string, T[]>();
  rows.forEach((row) => {
    const existing = map.get(row.productId) || [];
    existing.push(row);
    map.set(row.productId, existing);
  });
  return map;
};

export type ProductGraphQLLoaders = {
  categoryByProductId: RequestBatchLoader<string, any | null>;
  variantCardsByProductId: RequestBatchLoader<string, any[]>;
  variantsByProductId: RequestBatchLoader<string, any[]>;
};

export const createProductGraphQLLoaders = (
  prisma: PrismaClient
): ProductGraphQLLoaders => {
  const categoryByProductId = new RequestBatchLoader<string, any | null>(
    async (productIds) => {
      const rows = await prisma.product.findMany({
        where: { id: { in: [...productIds] } },
        select: {
          id: true,
          category: {
            select: {
              id: true,
              slug: true,
              name: true,
              description: true,
            },
          },
        },
      });

      const rowById = new Map(rows.map((row) => [row.id, row.category]));
      return new Map(productIds.map((productId) => [productId, rowById.get(productId) || null]));
    }
  );

  const variantsByProductId = new RequestBatchLoader<string, any[]>(
    async (productIds) => {
      const rows = await prisma.productVariant.findMany({
        where: { productId: { in: [...productIds] } },
        orderBy: [{ productId: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          productId: true,
          images: true,
          price: true,
          stock: true,
        },
      });
      const rowsByProductId = toProductIdMap(rows);

      return new Map(
        productIds.map((productId) => [productId, rowsByProductId.get(productId) || []])
      );
    }
  );

  const detailedVariantsByProductId = new RequestBatchLoader<string, any[]>(
    async (productIds) => {
      const rows = await prisma.productVariant.findMany({
        where: { productId: { in: [...productIds] } },
        orderBy: [{ productId: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          productId: true,
          sku: true,
          images: true,
          price: true,
          stock: true,
          lowStockThreshold: true,
          barcode: true,
          attributes: {
            select: {
              id: true,
              attribute: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
              value: {
                select: {
                  id: true,
                  value: true,
                  slug: true,
                },
              },
            },
          },
        },
      });
      const rowsByProductId = toProductIdMap(rows);

      return new Map(
        productIds.map((productId) => [productId, rowsByProductId.get(productId) || []])
      );
    }
  );

  return {
    categoryByProductId,
    variantCardsByProductId: variantsByProductId,
    variantsByProductId: detailedVariantsByProductId,
  };
};
