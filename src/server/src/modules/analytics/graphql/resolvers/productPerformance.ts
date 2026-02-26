import { getDateRange } from "@/shared/utils/analytics";
import { Context } from "../resolver";

const productPerformance = {
  Query: {
    productPerformance: async (
      _: any,
      { params }: any,
      { prisma }: Context
    ) => {
      const { timePeriod, year, startDate, endDate, category } = params;
      const { currentStartDate, yearStart, yearEnd } = getDateRange({
        timePeriod,
        year,
        startDate,
        endDate,
      });

      const orderItems = await prisma.orderItem.findMany({
        where: {
          createdAt: {
            ...(currentStartDate && { gte: currentStartDate }),
            ...(endDate && { lte: new Date(endDate) }),
            ...(yearStart && { gte: yearStart }),
            ...(yearEnd && { lte: yearEnd }),
          },
          // category filter commented out; adjust if needed
        },
        include: {
          variant: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      });

      const productSales: {
        [key: string]: {
          id: string;
          productId: string;
          productSlug: string | null;
          sku: string | null;
          name: string;
          quantity: number;
          revenue: number;
          skuSales: Record<string, number>;
        };
      } = {};

      for (const item of orderItems) {
        const productId = item.variant.product?.id || item.variantId;
        const productName = item.variant.product?.name || item.variant.sku || "Unknown";
        const productSlug = item.variant.product?.slug || null;
        const sku = item.variant.sku || null;

        if (!productSales[productId]) {
          productSales[productId] = {
            id: productId,
            productId,
            productSlug,
            sku,
            name: productName,
            quantity: 0,
            revenue: 0,
            skuSales: {},
          };
        }
        if (sku) {
          productSales[productId].skuSales[sku] =
            (productSales[productId].skuSales[sku] || 0) + item.quantity;
        }
        productSales[productId].quantity += item.quantity;
        productSales[productId].revenue +=
          item.quantity * (item.variant.price || 0);
      }

      return Object.values(productSales)
        .map((product) => {
          const topSku = Object.entries(product.skuSales).sort(
            (first, second) => second[1] - first[1]
          )[0]?.[0];
          return {
            id: product.id,
            productId: product.productId,
            productSlug: product.productSlug,
            sku: topSku || product.sku,
            name: product.name,
            quantity: product.quantity,
            revenue: product.revenue,
          };
        })
        .sort((a, b) => b.quantity - a.quantity);
    },
  },
};

export default productPerformance;
