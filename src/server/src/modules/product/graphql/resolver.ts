import AppError from "@/shared/errors/AppError";
import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { getDealerPriceMap } from "@/shared/utils/dealerAccess";

export interface Context {
  prisma: PrismaClient;
  req: Request;
  res: Response;
}

const applyDealerPricingToProducts = async (
  context: Context,
  products: any[]
): Promise<any[]> => {
  if (!products.length) {
    return products;
  }

  const userId = context.req.user?.id;
  const variantIds = products.flatMap((product) =>
    Array.isArray(product?.variants)
      ? product.variants.map((variant: any) => variant.id)
      : []
  );

  const dealerPriceMap = await getDealerPriceMap(
    context.prisma,
    userId,
    variantIds
  );

  if (!dealerPriceMap.size) {
    return products;
  }

  return products.map((product) => ({
    ...product,
    variants: Array.isArray(product?.variants)
      ? product.variants.map((variant: any) => ({
          ...variant,
          price: dealerPriceMap.get(variant.id) ?? variant.price,
        }))
      : product.variants,
  }));
};

const applyDealerPricingToProduct = async (
  context: Context,
  product: any | null
): Promise<any | null> => {
  if (!product) {
    return product;
  }

  const pricedProducts = await applyDealerPricingToProducts(context, [product]);
  return pricedProducts[0] ?? product;
};

export const productResolvers = {
  Query: {
    products: async (
      _: any,
      {
        first = 10,
        skip = 0,
        filters = {},
      }: {
        first?: number;
        skip?: number;
        filters?: {
          search?: string;
          isNew?: boolean;
          isFeatured?: boolean;
          isTrending?: boolean;
          isBestSeller?: boolean;
          minPrice?: number;
          maxPrice?: number;
          categoryId?: string;
          flags?: string[];
        };
      },
      context: Context
    ) => {
      const where: any = {};

      // Search filter
      const searchQuery = filters.search?.trim();
      if (searchQuery) {
        where.OR = [
          { name: { contains: searchQuery, mode: "insensitive" } },
          { description: { contains: searchQuery, mode: "insensitive" } },
          {
            category: {
              is: {
                name: { contains: searchQuery, mode: "insensitive" },
              },
            },
          },
          {
            variants: {
              some: {
                sku: { contains: searchQuery, mode: "insensitive" },
              },
            },
          },
        ];
      }

      // Flag filters
      if (filters.isNew !== undefined) where.isNew = filters.isNew;
      if (filters.isFeatured !== undefined)
        where.isFeatured = filters.isFeatured;
      if (filters.isTrending !== undefined)
        where.isTrending = filters.isTrending;
      if (filters.isBestSeller !== undefined)
        where.isBestSeller = filters.isBestSeller;

      // ✅ OR logic for multiple flags
      if (filters.flags && filters.flags.length > 0) {
        const flagConditions = filters.flags.map((flag) => ({ [flag]: true }));
        if (!where.OR) where.OR = [];
        where.OR = [...where.OR, ...flagConditions];
      }

      // Category filter
      if (filters.categoryId) {
        where.categoryId = filters.categoryId;
      }

      // Price filter (based on variants)
      if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
        where.variants = {
          some: {
            price: {
              ...(filters.minPrice !== undefined && { gte: filters.minPrice }),
              ...(filters.maxPrice !== undefined && { lte: filters.maxPrice }),
            },
          },
        };
      }

      const totalCount = await context.prisma.product.count({ where });
      const products = await context.prisma.product.findMany({
        where,
        take: first,
        skip,
        include: {
          category: true,
          variants: true,
          reviews: true,
        },
      });

      const pricedProducts = await applyDealerPricingToProducts(
        context,
        products
      );

      return {
        products: pricedProducts,
        hasMore: skip + products.length < totalCount,
        totalCount,
      };
    },
    product: async (_: any, { slug }: { slug: string }, context: Context) => {
      const product = await context.prisma.product.findUnique({
        where: { slug },
        include: {
          category: true,
          variants: {
            include: {
              attributes: {
                include: {
                  attribute: true,
                  value: true,
                },
              },
            },
          },
          reviews: true,
        },
      });
      if (!product) {
        throw new AppError(404, "Product not found");
      }
      return applyDealerPricingToProduct(context, product);
    },
    newProducts: async (
      _: any,
      { first = 10, skip = 0 }: { first?: number; skip?: number },
      context: Context
    ) => {
      const totalCount = await context.prisma.product.count({
        where: { isNew: true },
      });
      const products = await context.prisma.product.findMany({
        where: { isNew: true },
        take: first,
        skip,
        include: {
          category: true,
          variants: true,
          reviews: true,
        },
      });
      const pricedProducts = await applyDealerPricingToProducts(
        context,
        products
      );

      return {
        products: pricedProducts,
        hasMore: skip + products.length < totalCount,
        totalCount,
      };
    },
    featuredProducts: async (
      _: any,
      { first = 10, skip = 0 }: { first?: number; skip?: number },
      context: Context
    ) => {
      const totalCount = await context.prisma.product.count({
        where: { isFeatured: true },
      });
      const products = await context.prisma.product.findMany({
        where: { isFeatured: true },
        take: first,
        skip,
        include: {
          category: true,
          variants: true,
          reviews: true,
        },
      });
      const pricedProducts = await applyDealerPricingToProducts(
        context,
        products
      );

      return {
        products: pricedProducts,
        hasMore: skip + products.length < totalCount,
        totalCount,
      };
    },
    trendingProducts: async (
      _: any,
      { first = 10, skip = 0 }: { first?: number; skip?: number },
      context: Context
    ) => {
      const totalCount = await context.prisma.product.count({
        where: { isTrending: true },
      });
      const products = await context.prisma.product.findMany({
        where: { isTrending: true },
        take: first,
        skip,
        include: {
          category: true,
          variants: true,
          reviews: true,
        },
      });
      const pricedProducts = await applyDealerPricingToProducts(
        context,
        products
      );

      return {
        products: pricedProducts,
        hasMore: skip + products.length < totalCount,
        totalCount,
      };
    },
    bestSellerProducts: async (
      _: any,
      { first = 10, skip = 0 }: { first?: number; skip?: number },
      context: Context
    ) => {
      const totalCount = await context.prisma.product.count({
        where: { isBestSeller: true },
      });
      const products = await context.prisma.product.findMany({
        where: { isBestSeller: true },
        take: first,
        skip,
        include: {
          category: true,
          variants: true,
          reviews: true,
        },
      });
      const pricedProducts = await applyDealerPricingToProducts(
        context,
        products
      );

      return {
        products: pricedProducts,
        hasMore: skip + products.length < totalCount,
        totalCount,
      };
    },
    categories: async (_: any, __: any, context: Context) => {
      return context.prisma.category.findMany({
        include: {
          products: {
            include: {
              variants: true,
            },
          },
        },
      });
    },
  },

  Product: {
    reviews: (parent: any, _: any, context: Context) => {
      return context.prisma.review.findMany({
        where: { productId: parent.id },
        include: {
          user: true,
        },
      });
    },
  },
};
