import AppError from "@/shared/errors/AppError";
import { getCurrentRequestMetricStore } from "@/shared/observability/requestMetrics";
import { config } from "@/config";
import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";

export interface Context {
  prisma: PrismaClient;
  req: Request;
  res: Response;
}

type ProductFilters = {
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

type ProductCard = {
  id: string;
  name: string;
  slug: string;
  thumbnail: string | null;
  minPrice: number;
  maxPrice: number;
  category: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
  } | null;
};

type ProductConnection = {
  products: ProductCard[];
  hasMore: boolean;
  totalCount: number;
};

type ListingAggregate = {
  minPrice: number;
  maxPrice: number;
  thumbnail: string | null;
};

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;
const DEFAULT_NESTED_PAGE_SIZE = 25;
const MAX_NESTED_PAGE_SIZE = 50;

const CATALOG_CACHE_TTL_MS = 120_000;
const CATALOG_CACHE_MAX_ENTRIES = 400;

const catalogListingCache = new Map<
  string,
  {
    expiresAt: number;
    value: ProductConnection;
  }
>();

export const clearCatalogListingCache = () => {
  catalogListingCache.clear();
};

const parsePagination = (
  first: number | null | undefined,
  skip: number | null | undefined,
  options: {
    defaultFirst: number;
    maxFirst: number;
    label: string;
  }
) => {
  const requestedFirst =
    first === null || first === undefined ? options.defaultFirst : first;
  const resolvedSkip = skip === null || skip === undefined ? 0 : skip;

  if (!Number.isInteger(requestedFirst) || requestedFirst <= 0) {
    throw new AppError(400, `${options.label}: 'first' must be a positive integer.`);
  }

  if (!Number.isInteger(resolvedSkip) || resolvedSkip < 0) {
    throw new AppError(400, `${options.label}: 'skip' must be a non-negative integer.`);
  }

  return {
    requestedFirst,
    first: Math.min(requestedFirst, options.maxFirst),
    skip: resolvedSkip,
  };
};

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const objectValue = value as Record<string, unknown>;
  const sortedKeys = Object.keys(objectValue).sort();
  const serializedPairs = sortedKeys
    .filter((key) => objectValue[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`);

  return `{${serializedPairs.join(",")}}`;
};

const buildCatalogCacheKey = (options: {
  scope: string;
  first: number;
  skip: number;
  filters: ProductFilters;
}): string =>
  `catalog:${options.scope}:${stableStringify({
    first: options.first,
    skip: options.skip,
    filters: options.filters,
  })}`;

const getCachedListingConnection = (cacheKey: string): ProductConnection | null => {
  const cached = catalogListingCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    catalogListingCache.delete(cacheKey);
    return null;
  }

  return cached.value;
};

const setCachedListingConnection = (
  cacheKey: string,
  value: ProductConnection
): void => {
  if (catalogListingCache.size >= CATALOG_CACHE_MAX_ENTRIES) {
    const oldestKey = catalogListingCache.keys().next().value;
    if (oldestKey) {
      catalogListingCache.delete(oldestKey);
    }
  }

  catalogListingCache.set(cacheKey, {
    expiresAt: Date.now() + CATALOG_CACHE_TTL_MS,
    value,
  });
};

const buildProductWhere = (filters: ProductFilters) => {
  const where: any = {};

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

  if (filters.isNew !== undefined) {
    where.isNew = filters.isNew;
  }
  if (filters.isFeatured !== undefined) {
    where.isFeatured = filters.isFeatured;
  }
  if (filters.isTrending !== undefined) {
    where.isTrending = filters.isTrending;
  }
  if (filters.isBestSeller !== undefined) {
    where.isBestSeller = filters.isBestSeller;
  }

  if (filters.flags && filters.flags.length > 0) {
    const flagConditions = filters.flags.map((flag) => ({ [flag]: true }));
    if (!where.OR) {
      where.OR = [];
    }
    where.OR = [...where.OR, ...flagConditions];
  }

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

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

  return where;
};

const fetchListingAggregateByProductId = async (
  context: Context,
  productIds: string[]
): Promise<Map<string, ListingAggregate>> => {
  if (productIds.length === 0) {
    return new Map();
  }

  const variantRows = await context.prisma.productVariant.findMany({
    where: { productId: { in: productIds } },
    select: {
      productId: true,
      price: true,
      images: true,
      createdAt: true,
    },
    orderBy: [{ productId: "asc" }, { createdAt: "asc" }],
  });

  const aggregatesByProductId = new Map<string, ListingAggregate>();
  for (const productId of productIds) {
    aggregatesByProductId.set(productId, {
      minPrice: 0,
      maxPrice: 0,
      thumbnail: null,
    });
  }

  for (const variant of variantRows) {
    const aggregate = aggregatesByProductId.get(variant.productId);
    if (!aggregate) {
      continue;
    }

    const price = Number(variant.price ?? 0);
    if (aggregate.minPrice === 0 || price < aggregate.minPrice) {
      aggregate.minPrice = price;
    }
    if (price > aggregate.maxPrice) {
      aggregate.maxPrice = price;
    }

    if (!aggregate.thumbnail && Array.isArray(variant.images) && variant.images.length > 0) {
      aggregate.thumbnail = variant.images.find((image) => !!image) || null;
    }
  }

  return aggregatesByProductId;
};

const resolveProductConnection = async (
  context: Context,
  options: {
    scope: string;
    where: any;
    cacheFilters: ProductFilters;
    first?: number;
    skip?: number;
  }
): Promise<ProductConnection> => {
  const pagination = parsePagination(options.first, options.skip, {
    defaultFirst: DEFAULT_PAGE_SIZE,
    maxFirst: MAX_PAGE_SIZE,
    label: options.scope,
  });

  const cacheKey = buildCatalogCacheKey({
    scope: options.scope,
    first: pagination.first,
    skip: pagination.skip,
    filters: options.cacheFilters,
  });

  const requestStore = getCurrentRequestMetricStore();
  const queryCountBefore = requestStore?.queryCount || 0;
  const startedAt = Date.now();
  let cacheHit = false;

  const cached = getCachedListingConnection(cacheKey);
  if (cached) {
    cacheHit = true;
  }

  const result =
    cached ||
    (await (async () => {
      const totalCount = await context.prisma.product.count({
        where: options.where,
      });

      const products = await context.prisma.product.findMany({
        where: options.where,
        take: pagination.first,
        skip: pagination.skip,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          slug: true,
          name: true,
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

      const aggregateByProductId = await fetchListingAggregateByProductId(
        context,
        products.map((product) => product.id)
      );

      const mappedProducts: ProductCard[] = products.map((product) => {
        const aggregate = aggregateByProductId.get(product.id);
        return {
          id: product.id,
          name: product.name,
          slug: product.slug,
          thumbnail: aggregate?.thumbnail || null,
          minPrice: aggregate?.minPrice || 0,
          maxPrice: aggregate?.maxPrice || 0,
          category: product.category || null,
        };
      });

      const payload: ProductConnection = {
        products: mappedProducts,
        hasMore: pagination.skip + mappedProducts.length < totalCount,
        totalCount,
      };

      setCachedListingConnection(cacheKey, payload);
      return payload;
    })());

  const queryCountAfter = getCurrentRequestMetricStore()?.queryCount || queryCountBefore;
  const listingQueryCount = Math.max(0, queryCountAfter - queryCountBefore);
  const executionMs = Date.now() - startedAt;

  if (config.isDevelopment) {
    console.log(
      `[catalog] listing-summary ${JSON.stringify({
        traceId: context.req.traceId || "no-trace-id",
        scope: options.scope,
        skip: pagination.skip,
        requestedFirst: pagination.requestedFirst,
        first: pagination.first,
        queryCount: listingQueryCount,
        cacheHit,
        durationMs: executionMs,
      })}`
    );
  }

  return result;
};

export const productResolvers = {
  Query: {
    products: async (
      _: unknown,
      {
        first,
        skip,
        filters = {},
      }: {
        first?: number;
        skip?: number;
        filters?: ProductFilters;
      },
      context: Context
    ) => {
      const where = buildProductWhere(filters);
      return resolveProductConnection(context, {
        scope: "products",
        where,
        cacheFilters: filters,
        first,
        skip,
      });
    },
    product: async (_: unknown, { slug }: { slug: string }, context: Context) => {
      const product = await context.prisma.product.findUnique({
        where: { slug },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          salesCount: true,
          isNew: true,
          isFeatured: true,
          isTrending: true,
          isBestSeller: true,
          category: {
            select: {
              id: true,
              slug: true,
              name: true,
              description: true,
            },
          },
          variants: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
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
          },
        },
      });

      if (!product) {
        throw new AppError(404, "Product not found");
      }

      const thumbnail =
        product.variants.find((variant) => variant.images[0])?.images[0] || null;
      const price =
        product.variants.length > 0
          ? Math.min(...product.variants.map((variant) => Number(variant.price)))
          : 0;

      return {
        ...product,
        thumbnail,
        price,
      };
    },
    newProducts: async (
      _: unknown,
      { first, skip }: { first?: number; skip?: number },
      context: Context
    ) => {
      return resolveProductConnection(context, {
        scope: "newProducts",
        where: { isNew: true },
        cacheFilters: { isNew: true },
        first,
        skip,
      });
    },
    featuredProducts: async (
      _: unknown,
      { first, skip }: { first?: number; skip?: number },
      context: Context
    ) => {
      return resolveProductConnection(context, {
        scope: "featuredProducts",
        where: { isFeatured: true },
        cacheFilters: { isFeatured: true },
        first,
        skip,
      });
    },
    trendingProducts: async (
      _: unknown,
      { first, skip }: { first?: number; skip?: number },
      context: Context
    ) => {
      return resolveProductConnection(context, {
        scope: "trendingProducts",
        where: { isTrending: true },
        cacheFilters: { isTrending: true },
        first,
        skip,
      });
    },
    bestSellerProducts: async (
      _: unknown,
      { first, skip }: { first?: number; skip?: number },
      context: Context
    ) => {
      return resolveProductConnection(context, {
        scope: "bestSellerProducts",
        where: { isBestSeller: true },
        cacheFilters: { isBestSeller: true },
        first,
        skip,
      });
    },
    categories: async (
      _: unknown,
      { first, skip }: { first?: number; skip?: number },
      context: Context
    ) => {
      const pagination = parsePagination(first, skip, {
        defaultFirst: DEFAULT_PAGE_SIZE,
        maxFirst: MAX_PAGE_SIZE,
        label: "categories",
      });

      return context.prisma.category.findMany({
        take: pagination.first,
        skip: pagination.skip,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
        },
      });
    },
  },

  Product: {
    thumbnail: (parent: any) =>
      typeof parent.thumbnail === "string" && parent.thumbnail.length > 0
        ? parent.thumbnail
        : null,
    price: (parent: any) => {
      const value = Number(parent.price);
      return Number.isFinite(value) ? value : 0;
    },
    category: (parent: any) => parent.category || null,
    variants: (
      parent: any,
      { first, skip }: { first?: number; skip?: number }
    ) => {
      const pagination = parsePagination(first, skip, {
        defaultFirst: DEFAULT_NESTED_PAGE_SIZE,
        maxFirst: MAX_NESTED_PAGE_SIZE,
        label: "variants",
      });

      const variants = Array.isArray(parent.variants) ? parent.variants : [];
      return variants.slice(pagination.skip, pagination.skip + pagination.first);
    },
  },
};
