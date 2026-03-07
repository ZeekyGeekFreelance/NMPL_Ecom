import AppError from "@/shared/errors/AppError";
import { getCurrentRequestMetricStore } from "@/shared/observability/requestMetrics";
import { config } from "@/config";
import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import redisClient from "@/infra/cache/redis";
import { cacheKey } from "@/shared/utils/cacheKey";
import { getDealerPriceMap } from "@/shared/utils/dealerAccess";

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
  dealerMinPrice: number | null;
  dealerMaxPrice: number | null;
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
  totalCount: number | null;
};

type ListingAggregate = {
  minPrice: number;
  maxPrice: number;
  dealerMinPrice: number | null;
  dealerMaxPrice: number | null;
  hasDealerPricing: boolean;
  thumbnail: string | null;
};

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;
const DEFAULT_NESTED_PAGE_SIZE = 25;
const MAX_NESTED_PAGE_SIZE = 50;

// ── Redis-backed catalog cache ────────────────────────────────────────────────
// Shared across all processes/workers so invalidation on create/update/delete
// is immediately visible everywhere.  Falls back to the in-memory shim when
// REDIS_ENABLED=false (dev without Redis).

const CATALOG_CACHE_PREFIX = "catalog-listing";
const CATEGORY_CACHE_PREFIX = "catalog-category";

/**
 * Build a fully-qualified Redis key for a catalog listing query.
 * The raw key is hashed inside `cacheKey()` if it contains special chars.
 */
const buildRedisCatalogKey = (rawKey: string): string =>
  cacheKey(CATALOG_CACHE_PREFIX, rawKey);

const buildRedisCategoryKey = (rawKey: string): string =>
  cacheKey(CATEGORY_CACHE_PREFIX, rawKey);

const getCachedListingConnection = async (
  rawKey: string
): Promise<ProductConnection | null> => {
  try {
    const json = await redisClient.get(buildRedisCatalogKey(rawKey));
    if (!json) return null;
    return JSON.parse(json) as ProductConnection;
  } catch {
    // Redis unavailable — treat as a cache miss, never block the request.
    return null;
  }
};

const setCachedListingConnection = async (
  rawKey: string,
  value: ProductConnection
): Promise<void> => {
  try {
    await redisClient.setex(
      buildRedisCatalogKey(rawKey),
      config.cache.catalogTtlSeconds,
      JSON.stringify(value)
    );
  } catch {
    // Best-effort — a write failure just means the next request re-queries.
  }
};

const getCachedCategories = async (
  rawKey: string
): Promise<any[] | null> => {
  try {
    const json = await redisClient.get(buildRedisCategoryKey(rawKey));
    if (!json) return null;
    return JSON.parse(json) as any[];
  } catch {
    return null;
  }
};

const setCachedCategories = async (
  rawKey: string,
  value: any[]
): Promise<void> => {
  try {
    await redisClient.setex(
      buildRedisCategoryKey(rawKey),
      config.cache.categoryTtlSeconds,
      JSON.stringify(value)
    );
  } catch {
    // Best-effort.
  }
};

/**
 * Delete all catalog listing cache entries from Redis.
 * Uses a SCAN-based approach so it works on Redis Cluster and avoids
 * blocking the server with a KEYS call.
 */
export const clearCatalogListingCache = async (): Promise<void> => {
  try {
    const pattern = buildRedisCatalogKey("*");
    // The shim doesn't support scan — it implements del() which is enough for
    // the unit tests.  On a real Redis we use the safe SCAN + DEL pattern.
    if (typeof (redisClient as any).scan === "function") {
      let cursor = "0";
      do {
        const [nextCursor, keys]: [string, string[]] = await (
          redisClient as any
        ).scan(cursor, "MATCH", pattern, "COUNT", 200);
        cursor = nextCursor;
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      } while (cursor !== "0");
    } else {
      // InMemoryRedisShim path: construct and delete the pattern key directly.
      await redisClient.del(pattern);
    }
  } catch {
    // Non-fatal — worst case stale entries expire naturally.
  }
};

export const clearCategoryCache = async (): Promise<void> => {
  try {
    const pattern = buildRedisCategoryKey("*");
    if (typeof (redisClient as any).scan === "function") {
      let cursor = "0";
      do {
        const [nextCursor, keys]: [string, string[]] = await (
          redisClient as any
        ).scan(cursor, "MATCH", pattern, "COUNT", 200);
        cursor = nextCursor;
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      } while (cursor !== "0");
    } else {
      await redisClient.del(pattern);
    }
  } catch {
    // Non-fatal.
  }
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
  viewerKey: string;
}): string =>
  `catalog:${options.scope}:${stableStringify({
    viewer: options.viewerKey,
    first: options.first,
    skip: options.skip,
    filters: options.filters,
  })}`;

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
    // Flags are AND conditions on the product row (isNew, isFeatured, etc.).
    // They must NOT be merged into the search OR block — that would return
    // any product matching a flag regardless of whether it matches the search.
    for (const flag of filters.flags) {
      where[flag] = true;
    }
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
  productIds: string[],
  viewerUserId?: string
): Promise<Map<string, ListingAggregate>> => {
  if (productIds.length === 0) {
    return new Map();
  }

  const variantRows = await context.prisma.productVariant.findMany({
    where: { productId: { in: productIds } },
    select: {
      id: true,
      productId: true,
      price: true,
      images: true,
      createdAt: true,
    },
    orderBy: [{ productId: "asc" }, { createdAt: "asc" }],
  });
  const dealerPriceMap = await getDealerPriceMap(
    context.prisma,
    viewerUserId,
    variantRows.map((variant) => variant.id)
  );

  const aggregatesByProductId = new Map<string, ListingAggregate>();
  for (const productId of productIds) {
    aggregatesByProductId.set(productId, {
      minPrice: 0,
      maxPrice: 0,
      dealerMinPrice: null,
      dealerMaxPrice: null,
      hasDealerPricing: false,
      thumbnail: null,
    });
  }

  for (const variant of variantRows) {
    const aggregate = aggregatesByProductId.get(variant.productId);
    if (!aggregate) {
      continue;
    }

    const basePrice = Number(variant.price ?? 0);
    const dealerPrice = dealerPriceMap.get(variant.id);
    const effectivePrice =
      typeof dealerPrice === "number" ? dealerPrice : basePrice;

    if (aggregate.minPrice === 0 || basePrice < aggregate.minPrice) {
      aggregate.minPrice = basePrice;
    }
    if (basePrice > aggregate.maxPrice) {
      aggregate.maxPrice = basePrice;
    }

    if (aggregate.dealerMinPrice === null || effectivePrice < aggregate.dealerMinPrice) {
      aggregate.dealerMinPrice = effectivePrice;
    }
    if (aggregate.dealerMaxPrice === null || effectivePrice > aggregate.dealerMaxPrice) {
      aggregate.dealerMaxPrice = effectivePrice;
    }

    if (typeof dealerPrice === "number") {
      aggregate.hasDealerPricing = true;
    }

    if (!aggregate.thumbnail && Array.isArray(variant.images) && variant.images.length > 0) {
      aggregate.thumbnail = variant.images.find((image) => !!image) || null;
    }
  }

  return aggregatesByProductId;
};

/**
 * Returns true if `fieldName` is present in the top-level selection set of
 * `info`.  Used to skip expensive COUNT(*) queries when the client doesn't
 * request totalCount.
 */
const isFieldSelected = (info: any, fieldName: string): boolean => {
  try {
    const selections: any[] =
      info?.fieldNodes?.[0]?.selectionSet?.selections ?? [];
    return selections.some(
      (sel: any) => sel.kind === "Field" && sel.name?.value === fieldName
    );
  } catch {
    // If info is unavailable (e.g. called outside a resolver), default safe.
    return true;
  }
};

const resolveProductConnection = async (
  context: Context,
  options: {
    scope: string;
    where: any;
    cacheFilters: ProductFilters;
    first?: number;
    skip?: number;
    needsTotalCount?: boolean;
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
    viewerKey: context.req.user?.id || "anonymous",
  });

  const requestStore = getCurrentRequestMetricStore();
  const queryCountBefore = requestStore?.queryCount || 0;
  const startedAt = Date.now();
  let cacheHit = false;

  const cached = await getCachedListingConnection(cacheKey);
  if (cached) {
    cacheHit = true;
  }

  const result: ProductConnection =
    cached ||
    (await (async () => {
      const totalCount = options.needsTotalCount
        ? await context.prisma.product.count({ where: options.where })
        : null;

      // Fetch one extra row so we can detect whether a next page exists
      // without a separate COUNT query.  The extra row is never exposed to
      // the client.
      const products = await context.prisma.product.findMany({
        where: options.where,
        take: pagination.first + 1,
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

      // The sentinel row proves there is a next page; drop it before mapping.
      const hasNextPage = products.length > pagination.first;
      const pageProducts = hasNextPage ? products.slice(0, pagination.first) : products;

      const aggregateByProductId = await fetchListingAggregateByProductId(
        context,
        pageProducts.map((product) => product.id),
        context.req.user?.id
      );

      const mappedProducts: ProductCard[] = pageProducts
        .filter((product) => {
          // Exclude products with no variants — they have no price to display
          // and would render as broken cards on the frontend.
          const aggregate = aggregateByProductId.get(product.id);
          return aggregate !== undefined && aggregate.minPrice > 0;
        })
        .map((product) => {
          const aggregate = aggregateByProductId.get(product.id)!;
          return {
            id: product.id,
            name: product.name,
            slug: product.slug,
            thumbnail: aggregate.thumbnail || null,
            minPrice: aggregate.minPrice,
            maxPrice: aggregate.maxPrice,
            dealerMinPrice: aggregate.hasDealerPricing
              ? aggregate.dealerMinPrice
              : null,
            dealerMaxPrice: aggregate.hasDealerPricing
              ? aggregate.dealerMaxPrice
              : null,
            category: product.category || null,
          };
        });

      const payload: ProductConnection = {
        products: mappedProducts,
        hasMore: hasNextPage,
        totalCount,
      };

      await setCachedListingConnection(cacheKey, payload);
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
      context: Context,
      info: any
    ) => {
      const where = buildProductWhere(filters);
      return resolveProductConnection(context, {
        scope: "products",
        where,
        cacheFilters: filters,
        first,
        skip,
        // Only fire COUNT(*) when the client actually selects totalCount.
        // GET_HOME_PAGE_DATA never selects it — saves 4 DB round-trips on SSR.
        needsTotalCount: isFieldSelected(info, "totalCount"),
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
      const dealerPriceMap = await getDealerPriceMap(
        context.prisma,
        context.req.user?.id,
        product.variants.map((variant) => variant.id)
      );

      const pricedVariants = product.variants.map((variant) => ({
        ...variant,
        retailPrice: variant.price,
        price: dealerPriceMap.get(variant.id) ?? variant.price,
      }));

      const thumbnail =
        pricedVariants.find((variant) => variant.images[0])?.images[0] || null;
      const price =
        pricedVariants.length > 0
          ? Math.min(...pricedVariants.map((variant) => Number(variant.price)))
          : 0;

      return {
        ...product,
        variants: pricedVariants,
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

      const cacheKey = `categories:${pagination.first}:${pagination.skip}`;
      const cached = await getCachedCategories(cacheKey);
      if (cached) {
        return cached;
      }

      const rows = await context.prisma.category.findMany({
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

      await setCachedCategories(cacheKey, rows);

      return rows;
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
