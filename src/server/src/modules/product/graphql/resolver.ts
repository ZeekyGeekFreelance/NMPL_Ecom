import AppError from "@/shared/errors/AppError";
import { getCurrentRequestMetricStore } from "@/shared/observability/requestMetrics";
import { config } from "@/config";
import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import redisClient from "@/infra/cache/redis";
import { cacheKey } from "@/shared/utils/cacheKey";
import { getDealerPriceMap, isDealerTableMissing } from "@/shared/utils/dealerAccess";
import { collapseVisibleVariants } from "@/shared/utils/publicVariantGrouping";
import type prismaClient from "@/infra/database/database.config";
// Re-export from the canonical shared module — keeps any existing imports
// pointing at resolver.ts working, and avoids duplicating the implementation.
export { clearCatalogListingCache, clearCategoryCache } from "@/shared/utils/catalogCache";

export interface Context {
  prisma: typeof prismaClient;
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

type HomePageCatalog = {
  featured: ProductCard[];
  trending: ProductCard[];
  newArrivals: ProductCard[];
  bestSellers: ProductCard[];
  categories: Array<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
  }>;
};

type ProductCardRow = {
  id: string;
  slug: string;
  name: string;
  category: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
  } | null;
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
// Categories are leaf metadata rows — much cheaper to load than products.
// Allow clients to fetch up to 200 per page so the shop filter dropdown can
// be populated in 7 requests for a 1 330-category catalogue, and the home
// page category bar can show a meaningful sample in a single request.
const DEFAULT_CATEGORY_PAGE_SIZE = 50;
const MAX_CATEGORY_PAGE_SIZE = 200;

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

const getCachedHomePageCatalog = async (
  rawKey: string
): Promise<HomePageCatalog | null> => {
  try {
    const json = await redisClient.get(buildRedisCatalogKey(rawKey));
    if (!json) return null;
    return JSON.parse(json) as HomePageCatalog;
  } catch {
    return null;
  }
};

const setCachedHomePageCatalog = async (
  rawKey: string,
  value: HomePageCatalog
): Promise<void> => {
  try {
    await redisClient.setex(
      buildRedisCatalogKey(rawKey),
      config.cache.catalogTtlSeconds,
      JSON.stringify(value)
    );
  } catch {
    // Best-effort only.
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

/**
 * Bucket viewers into one of three tiers for cache key purposes:
 *   "retail"          — anonymous or authenticated non-dealer users (all see retail prices)
 *   "dealer:{userId}" — dealers each have custom pricing, so must be isolated
 *
 * This collapses the anonymous + retail-user population into a single shared
 * cache entry per query, eliminating O(Users × Queries) key cardinality.
 * Dealer cardinality is unavoidable because pricing is per-dealer.
 */
const resolveViewerCacheKey = (req: Request): string => {
  const user = req.user;
  if (!user?.id) return "retail";
  const role = String(user.effectiveRole || user.role || "").toUpperCase();
  if (role === "DEALER") return `dealer:${user.id}`;
  return "retail";
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

const normalizeProductFilters = (
  filters: ProductFilters | null | undefined
): ProductFilters => {
  const safe = filters && typeof filters === "object" ? filters : {};
  const normalizeText = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
  const normalizeNumber = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined;
  const normalizeBoolean = (value: unknown): boolean | undefined =>
    typeof value === "boolean" ? value : undefined;
  const normalizeFlags = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const cleaned = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
    return cleaned.length > 0 ? cleaned : undefined;
  };

  return {
    search: normalizeText(safe.search),
    categoryId: normalizeText(safe.categoryId),
    minPrice: normalizeNumber(safe.minPrice),
    maxPrice: normalizeNumber(safe.maxPrice),
    isNew: normalizeBoolean(safe.isNew),
    isFeatured: normalizeBoolean(safe.isFeatured),
    isTrending: normalizeBoolean(safe.isTrending),
    isBestSeller: normalizeBoolean(safe.isBestSeller),
    flags: normalizeFlags(safe.flags),
  };
};

const buildProductWhere = (filters: ProductFilters) => {
  const where: any = {
    isDeleted: false, // Exclude soft-deleted products
  };

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

  return where;
};

const fetchRetailPriceMatchedProductIds = async (
  context: Context,
  filters: ProductFilters
): Promise<string[]> => {
  const rows = await context.prisma.productVariant.findMany({
    where: {
      price: {
        ...(filters.minPrice !== undefined && { gte: filters.minPrice }),
        ...(filters.maxPrice !== undefined && { lte: filters.maxPrice }),
      },
    },
    select: {
      productId: true,
    },
    distinct: ["productId"],
  });

  return rows.map((row) => row.productId);
};

const fetchEffectivePriceMatchedProductIds = async (
  context: Context,
  filters: ProductFilters
): Promise<string[] | null> => {
  if (filters.minPrice === undefined && filters.maxPrice === undefined) {
    return null;
  }

  const viewerRole = String(
    context.req.user?.effectiveRole || context.req.user?.role || ""
  ).toUpperCase();
  const dealerUserId =
    viewerRole === "DEALER" ? context.req.user?.id || undefined : undefined;

  if (!dealerUserId) {
    return fetchRetailPriceMatchedProductIds(context, filters);
  }

  try {
    const effectivePriceExpression = Prisma.sql`COALESCE(m."customPrice", pv."defaultDealerPrice", pv."price")`;
    const predicates: Prisma.Sql[] = [];

    if (filters.minPrice !== undefined) {
      predicates.push(
        Prisma.sql`${effectivePriceExpression} >= ${filters.minPrice}`
      );
    }

    if (filters.maxPrice !== undefined) {
      predicates.push(
        Prisma.sql`${effectivePriceExpression} <= ${filters.maxPrice}`
      );
    }

    const rows = await context.prisma.$queryRaw<Array<{ productId: string }>>(
      Prisma.sql`
        SELECT DISTINCT pv."productId" AS "productId"
        FROM "ProductVariant" pv
        LEFT JOIN "DealerPriceMapping" m
          ON m."variantId" = pv."id"
         AND m."dealerId" = ${dealerUserId}
        WHERE ${Prisma.join(predicates, " AND ")}
      `
    );

    return rows.map((row) => row.productId);
  } catch (error) {
    if (isDealerTableMissing(error)) {
      return fetchRetailPriceMatchedProductIds(context, filters);
    }

    throw error;
  }
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
    orderBy: [{ productId: "asc" }, { createdAt: "asc" }],
  });
  const dealerPriceMap = await getDealerPriceMap(
    context.prisma,
    viewerUserId,
    variantRows.map((variant) => variant.id)
  );

  const canonicalVariantRows = collapseVisibleVariants(
    variantRows.map((variant) => ({
      ...variant,
      retailPrice: Number(variant.price ?? 0),
      price: dealerPriceMap.get(variant.id) ?? Number(variant.price ?? 0),
    }))
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

  for (const variant of canonicalVariantRows) {
    const aggregate = aggregatesByProductId.get(variant.productId);
    if (!aggregate) {
      continue;
    }

    const basePrice = Number(variant.retailPrice ?? variant.price ?? 0);
    const effectivePrice = Number(variant.price ?? basePrice);

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

    if (Math.abs(effectivePrice - basePrice) > 0.0001) {
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

  const catalogCacheKey = buildCatalogCacheKey({
    scope: options.scope,
    first: pagination.first,
    skip: pagination.skip,
    filters: options.cacheFilters,
    viewerKey: resolveViewerCacheKey(context.req),
  });

  const requestStore = getCurrentRequestMetricStore();
  const queryCountBefore = requestStore?.queryCount || 0;
  const startedAt = Date.now();
  let cacheHit = false;

  const cached = await getCachedListingConnection(catalogCacheKey);
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

      const mappedProducts = mapProductRowsToCards(pageProducts, aggregateByProductId);

      const payload: ProductConnection = {
        products: mappedProducts,
        hasMore: hasNextPage,
        totalCount,
      };

      await setCachedListingConnection(catalogCacheKey, payload);
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

const mapProductRowsToCards = (
  products: ProductCardRow[],
  aggregateByProductId: Map<string, ListingAggregate>
): ProductCard[] =>
  products
    .filter((product) => {
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

const fetchHomePageCatalog = async (
  context: Context,
  pageSize?: number | null
): Promise<HomePageCatalog> => {
  const pagination = parsePagination(pageSize, 0, {
    defaultFirst: DEFAULT_PAGE_SIZE,
    maxFirst: MAX_PAGE_SIZE,
    label: "homePageCatalog",
  });

  const homeCatalogCacheKey = buildCatalogCacheKey({
    scope: "homePageCatalog",
    first: pagination.first,
    skip: 0,
    filters: {},
    viewerKey: resolveViewerCacheKey(context.req),
  });

  const cached = await getCachedHomePageCatalog(homeCatalogCacheKey);
  if (cached) {
    return cached;
  }

  const productSelect = {
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
  } as const;

  const [featuredRows, trendingRows, newArrivalRows, bestSellerRows, categories] =
    await Promise.all([
      context.prisma.product.findMany({
        where: { isFeatured: true, isDeleted: false },
        take: pagination.first,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: productSelect,
      }),
      context.prisma.product.findMany({
        where: { isTrending: true, isDeleted: false },
        take: pagination.first,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: productSelect,
      }),
      context.prisma.product.findMany({
        where: { isNew: true, isDeleted: false },
        take: pagination.first,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: productSelect,
      }),
      context.prisma.product.findMany({
        where: { isBestSeller: true, isDeleted: false },
        take: pagination.first,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: productSelect,
      }),
      context.prisma.category.findMany({
        take: 20,
        orderBy: { name: "asc" },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
        },
      }),
    ]);

  const uniqueProductIds = Array.from(
    new Set(
      [
        ...featuredRows,
        ...trendingRows,
        ...newArrivalRows,
        ...bestSellerRows,
      ].map((product) => product.id)
    )
  );

  const aggregateByProductId = await fetchListingAggregateByProductId(
    context,
    uniqueProductIds,
    context.req.user?.id
  );

  const payload: HomePageCatalog = {
    featured: mapProductRowsToCards(featuredRows as ProductCardRow[], aggregateByProductId),
    trending: mapProductRowsToCards(trendingRows as ProductCardRow[], aggregateByProductId),
    newArrivals: mapProductRowsToCards(
      newArrivalRows as ProductCardRow[],
      aggregateByProductId
    ),
    bestSellers: mapProductRowsToCards(
      bestSellerRows as ProductCardRow[],
      aggregateByProductId
    ),
    categories,
  };

  await setCachedHomePageCatalog(homeCatalogCacheKey, payload);
  return payload;
};

export const productResolvers = {
  Query: {
    homePageCatalog: async (
      _: unknown,
      { pageSize }: { pageSize?: number | null },
      context: Context
    ) => {
      return fetchHomePageCatalog(context, pageSize);
    },
    products: async (
      _: unknown,
      {
        first,
        skip,
        filters = {},
      }: {
        first?: number;
        skip?: number;
        filters?: ProductFilters | null;
      },
      context: Context,
      info: any
    ) => {
      const normalizedFilters = normalizeProductFilters(filters);
      const baseWhere = buildProductWhere(normalizedFilters);
      const priceMatchedProductIds = await fetchEffectivePriceMatchedProductIds(
        context,
        normalizedFilters
      );
      const where =
        priceMatchedProductIds === null
          ? baseWhere
          : {
              ...baseWhere,
              id: {
                in: priceMatchedProductIds,
              },
            };
      return resolveProductConnection(context, {
        scope: "products",
        where,
        cacheFilters: normalizedFilters,
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
              createdAt: true,
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
      const visibleVariants = collapseVisibleVariants(pricedVariants);

      const thumbnail =
        visibleVariants.find((variant) => variant.images[0])?.images[0] || null;
      const price =
        visibleVariants.length > 0
          ? Math.min(...visibleVariants.map((variant) => Number(variant.price)))
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
        where: { isNew: true, isDeleted: false },
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
        where: { isFeatured: true, isDeleted: false },
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
        where: { isTrending: true, isDeleted: false },
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
        where: { isBestSeller: true, isDeleted: false },
        cacheFilters: { isBestSeller: true },
        first,
        skip,
      });
    },
    categories: async (
      _: unknown,
      { first, skip, search }: { first?: number; skip?: number; search?: string },
      context: Context
    ) => {
      const pagination = parsePagination(first, skip, {
        defaultFirst: DEFAULT_CATEGORY_PAGE_SIZE,
        maxFirst: MAX_CATEGORY_PAGE_SIZE,
        label: "categories",
      });

      const trimmedSearch = search?.trim() || "";
      // Search queries bypass cache — they are rare (admin / filter UX) and
      // highly variable, so caching would just thrash with no benefit.
      const isCacheable = !trimmedSearch;
      const rawCacheKey = `categories:${pagination.first}:${pagination.skip}`;
      if (isCacheable) {
        const cached = await getCachedCategories(rawCacheKey);
        if (cached) {
          return cached;
        }
      }

      const where = trimmedSearch
        ? { name: { contains: trimmedSearch, mode: "insensitive" as const } }
        : {};

      const rows = await context.prisma.category.findMany({
        where,
        take: pagination.first,
        skip: pagination.skip,
        orderBy: { name: "asc" }, // stable alpha order is more useful than insert order
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
        },
      });

      if (isCacheable) {
        await setCachedCategories(rawCacheKey, rows);
      }

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
