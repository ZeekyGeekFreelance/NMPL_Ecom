"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useSearchParams } from "next/navigation";
import { useApolloClient, useQuery, NetworkStatus } from "@apollo/client";
import { motion, AnimatePresence } from "framer-motion";
import { Package, Filter } from "lucide-react";
import { GET_PRODUCTS } from "@/app/gql/Product";
import { Product } from "@/app/types/productTypes";
import ProductCard from "../product/ProductCard";
import MainLayout from "@/app/components/templates/MainLayout";
import Dropdown from "@/app/components/molecules/Dropdown";
import ProductFilters from "./ProductFilters";
import { useDealerCatalogPollInterval } from "@/app/hooks/network/useDealerCatalogPollInterval";
import { useMediaQuery } from "@/app/hooks/useMediaQuery";
import { useBackendReady } from "@/app/hooks/network/useBackendReady";
import { getProductListingPriceSummary } from "@/app/lib/productPricing";
import {
  DEFAULT_SORT,
  FilterValues,
  buildShopFiltersFromReader,
  getShopRequestPageSize,
  normalizeShopServerFilters,
  SortByOption,
} from "./shopShared";
import type { ProductConnectionPayload } from "@/app/lib/serverProductQueries";
import LoadingDots from "@/app/components/feedback/LoadingDots";
import MiniSpinner from "@/app/components/feedback/MiniSpinner";

const SORT_OPTIONS: Array<{ label: string; value: SortByOption }> = [
  { label: "Relevance", value: "RELEVANCE" },
  { label: "Price: Low to High", value: "PRICE_ASC" },
  { label: "Price: High to Low", value: "PRICE_DESC" },
  { label: "Name: A to Z", value: "NAME_ASC" },
];

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const getFilterSignature = (filters: FilterValues) =>
  JSON.stringify({
    search: filters.search || "",
    sortBy: filters.sortBy || DEFAULT_SORT,
    categoryId: filters.categoryId || null,
    minPrice: Number.isFinite(filters.minPrice) ? filters.minPrice : null,
    maxPrice: Number.isFinite(filters.maxPrice) ? filters.maxPrice : null,
    isNew: Boolean(filters.isNew),
    isFeatured: Boolean(filters.isFeatured),
    isTrending: Boolean(filters.isTrending),
    isBestSeller: Boolean(filters.isBestSeller),
  });

const getVariantMinPrice = (product: Product) => {
  const { effectivePrice } = getProductListingPriceSummary(product);
  return effectivePrice > 0 ? effectivePrice : Number.POSITIVE_INFINITY;
};

const buildSearchHaystack = (product: Product) => {
  const skus = (product.variants || []).map((variant) => variant.sku).join(" ");
  const category = product.category?.name || "";
  const description = product.description || "";
  return normalizeText(
    `${product.name} ${product.slug || ""} ${description} ${category} ${skus} ${
      product.isBestSeller ? "best seller" : ""
    }`
  );
};

const getSearchScore = (product: Product, rawQuery: string) => {
  const query = normalizeText(rawQuery);
  if (!query) {
    return 0;
  }

  const name = normalizeText(product.name || "");
  const haystack = buildSearchHaystack(product);
  const tokens = query.split(" ").filter(Boolean);

  let score = 0;

  if (name === query) score += 400;
  if (name.startsWith(query)) score += 260;
  if (haystack.startsWith(query)) score += 180;
  if (haystack.includes(query)) score += 140;

  for (const token of tokens) {
    if (name.startsWith(token)) score += 60;
    if (name.includes(token)) score += 45;
    if (haystack.includes(token)) score += 25;
  }

  return score;
};

interface ShopPageClientProps {
  initialFilters: FilterValues;
  initialConnection: ProductConnectionPayload;
}

const ShopPageClient: React.FC<ShopPageClientProps> = ({
  initialFilters: serverInitialFilters,
  initialConnection,
}) => {
  const searchParams = useSearchParams();
  const apolloClient = useApolloClient();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const backendReady = useBackendReady();
  const seededQueryKeysRef = useRef<Set<string>>(new Set());

  const initialVariables = useMemo(
    () => ({
      first: getShopRequestPageSize(serverInitialFilters),
      skip: 0,
      filters: normalizeShopServerFilters(serverInitialFilters),
    }),
    [serverInitialFilters]
  );

  const initialQueryKey = useMemo(
    () => JSON.stringify(initialVariables),
    [initialVariables]
  );

  if (
    !initialConnection.isFallback &&
    !seededQueryKeysRef.current.has(initialQueryKey)
  ) {
    try {
      apolloClient.writeQuery({
        query: GET_PRODUCTS,
        variables: initialVariables,
        data: {
          products: {
            __typename: "ProductConnection",
            products: initialConnection.products,
            hasMore: initialConnection.hasMore,
            totalCount: initialConnection.totalCount,
          },
        },
      });
      seededQueryKeysRef.current.add(initialQueryKey);
    } catch {
      // Safe to ignore. The next render will retry the seed.
    }
  }

  const urlFilters = useMemo(
    () =>
      buildShopFiltersFromReader(
        (key) => searchParams.get(key) ?? undefined
      ),
    [searchParams]
  );
  const urlFilterSignature = useMemo(
    () => getFilterSignature(urlFilters),
    [urlFilters]
  );

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filters, setFilters] = useState<FilterValues>(serverInitialFilters);
  const [displayedProducts, setDisplayedProducts] = useState<Product[]>(
    initialConnection.products
  );
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(initialConnection.hasMore);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const requestPageSize = getShopRequestPageSize(filters);
  const dealerCatalogPollInterval = useDealerCatalogPollInterval(skip === 0);
  const currentSortBy = (filters.sortBy || DEFAULT_SORT) as SortByOption;

  const serverFilters = useMemo(
    () => normalizeShopServerFilters(filters),
    [filters]
  );

  const activeFilterCount = useMemo(
    () =>
      Object.values(serverFilters).filter(
        (value) => value !== undefined && value !== "" && value !== false
      ).length,
    [serverFilters]
  );

  const {
    loading,
    error,
    data: queryData,
    fetchMore,
    refetch,
    networkStatus,
  } = useQuery(GET_PRODUCTS, {
    variables: { first: requestPageSize, skip: 0, filters: serverFilters },
    fetchPolicy: initialConnection.isFallback ? "network-only" : "cache-first",
    nextFetchPolicy: "cache-first",
    context: { skipGlobalActivity: true },
    pollInterval: dealerCatalogPollInterval,
    notifyOnNetworkStatusChange: false,
    skip: !backendReady,
  });

  const isRealNetworkError = networkStatus === NetworkStatus.error;
  const displayError =
    backendReady && error && isRealNetworkError && displayedProducts.length === 0
      ? error
      : undefined;

  useEffect(() => {
    const fresh = queryData?.products;
    if (!fresh) return;
    setDisplayedProducts(fresh.products);
    setHasMore(fresh.hasMore);
    setSkip(0);
  }, [queryData]);

  useEffect(() => {
    setFilters((currentFilters) =>
      getFilterSignature(currentFilters) === urlFilterSignature
        ? currentFilters
        : urlFilters
    );
  }, [urlFilterSignature, urlFilters]);

  useEffect(() => {
    setDisplayedProducts(initialConnection.products);
    setHasMore(initialConnection.hasMore);
    setSkip(0);
  }, [initialConnection]);

  useEffect(() => {
    if (!sidebarOpen || isDesktop) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen, isDesktop]);

  useEffect(() => {
    if (isDesktop && sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [isDesktop, sidebarOpen]);

  const syncFiltersToUrl = useCallback(
    (nextFilters: FilterValues) => {
      const query = new URLSearchParams();

      if (nextFilters.search?.trim()) {
        query.set("search", nextFilters.search.trim());
      }
      if (nextFilters.sortBy && nextFilters.sortBy !== DEFAULT_SORT) {
        query.set("sortBy", nextFilters.sortBy);
      }
      if (nextFilters.isNew) query.set("isNew", "true");
      if (nextFilters.isFeatured) query.set("isFeatured", "true");
      if (nextFilters.isTrending) query.set("isTrending", "true");
      if (nextFilters.isBestSeller) query.set("isBestSeller", "true");
      if (Number.isFinite(nextFilters.minPrice)) {
        query.set("minPrice", String(nextFilters.minPrice));
      }
      if (Number.isFinite(nextFilters.maxPrice)) {
        query.set("maxPrice", String(nextFilters.maxPrice));
      }
      if (nextFilters.categoryId) {
        query.set("categoryId", nextFilters.categoryId);
      }

      const nextQuery = query.toString();
      const nextUrl = nextQuery ? `/shop?${nextQuery}` : "/shop";
      if (typeof window !== "undefined") {
        const currentUrl = `${window.location.pathname}${window.location.search}`;
        if (currentUrl !== nextUrl) {
          window.history.replaceState(window.history.state, "", nextUrl);
        }
      }
    },
    []
  );

  const applyFilters = useCallback(
    (nextFilters: FilterValues) => {
      setFilters(nextFilters);
      syncFiltersToUrl(nextFilters);
    },
    [syncFiltersToUrl]
  );

  const updateFilters = useCallback(
    (nextFilters: FilterValues) => {
      applyFilters({
        ...nextFilters,
        sortBy: (nextFilters.sortBy || currentSortBy) as SortByOption,
      });
    },
    [applyFilters, currentSortBy]
  );

  const handleSortChange = useCallback(
    (nextSort: SortByOption) => {
      applyFilters({
        ...filters,
        sortBy: nextSort,
      });
    },
    [applyFilters, filters]
  );

  const handleShowMore = async () => {
    if (isFetchingMore) return;

    setIsFetchingMore(true);
    const newSkip = skip + requestPageSize;

    try {
      await fetchMore({
        variables: {
          first: requestPageSize,
          skip: newSkip,
          filters: serverFilters,
        },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult) return prev;

          const newProducts = fetchMoreResult.products.products;
          const newHasMore = fetchMoreResult.products.hasMore;

          setDisplayedProducts((prevProducts) => [
            ...prevProducts,
            ...newProducts,
          ]);
          setSkip(newSkip);
          setHasMore(newHasMore);

          return {
            products: {
              ...fetchMoreResult.products,
              products: [...prev.products.products, ...newProducts],
            },
          };
        },
      });
    } finally {
      setIsFetchingMore(false);
    }
  };

  const handleReset = useCallback(() => {
    applyFilters({
      search: "",
      sortBy: DEFAULT_SORT,
      categoryId: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      isNew: undefined,
      isFeatured: undefined,
      isTrending: undefined,
      isBestSeller: undefined,
    });
  }, [applyFilters]);

  const rankedAndSortedProducts = useMemo(() => {
    const query = filters.search || "";
    const hasQuery = normalizeText(query).length > 0;

    const rows = displayedProducts
      .map((product) => ({
        product,
        score: getSearchScore(product, query),
      }))
      .filter((row) => !hasQuery || row.score > 0);

    const compareBySortPreference = (
      leftProduct: Product,
      rightProduct: Product
    ) => {
      switch (currentSortBy) {
        case "PRICE_ASC":
          return getVariantMinPrice(leftProduct) - getVariantMinPrice(rightProduct);
        case "PRICE_DESC":
          return getVariantMinPrice(rightProduct) - getVariantMinPrice(leftProduct);
        case "NAME_ASC":
          return (leftProduct.name || "").localeCompare(rightProduct.name || "");
        case "RELEVANCE":
        default:
          return 0;
      }
    };

    rows.sort((left, right) => {
      if (hasQuery && right.score !== left.score) {
        return right.score - left.score;
      }

      const sortComparison = compareBySortPreference(left.product, right.product);
      if (sortComparison !== 0) {
        return sortComparison;
      }

      return (left.product.name || "").localeCompare(right.product.name || "");
    });

    return rows.map((row) => row.product);
  }, [currentSortBy, displayedProducts, filters.search]);

  const noProductsFound =
    backendReady &&
    rankedAndSortedProducts.length === 0 &&
    !loading &&
    !displayError;
  const isCatalogBootstrapping =
    (!backendReady || loading) && displayedProducts.length === 0;

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 pt-0 pb-6 sm:px-6 sm:pt-0 sm:pb-6 lg:px-8 lg:pt-0 lg:pb-8">
          <div className="flex gap-6 lg:gap-8">
            <div className="hidden lg:block lg:w-[320px] lg:self-stretch xl:w-[360px]">
              <ProductFilters
                initialFilters={urlFilters}
                currentSortBy={currentSortBy}
                onFilterChange={updateFilters}
              />
            </div>

            <section className="min-w-0 flex-1">
              <div className="sticky top-16 z-20 -mx-6 mb-5 rounded-lg border border-gray-200 bg-white p-3 shadow-sm sm:mx-0 md:top-[7rem] sm:rounded-xl sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSidebarOpen(true)}
                      className="btn-secondary lg:hidden"
                      aria-label="Open filters"
                      aria-expanded={sidebarOpen}
                    >
                      <Filter size={16} />
                      <span>Filters</span>
                      {activeFilterCount > 0 && (
                        <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs font-bold text-white">
                          {activeFilterCount}
                        </span>
                      )}
                    </button>

                    <p className="text-sm text-gray-600">
                      {isCatalogBootstrapping ? (
                        <span className="inline-flex items-center gap-2 font-medium text-gray-700">
                          <LoadingDots label="Loading" />
                        </span>
                      ) : (
                        <>
                          <span className="font-semibold text-gray-900">
                            {rankedAndSortedProducts.length}
                          </span>{" "}
                          products found
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 sm:justify-end">
                    <label
                      htmlFor="shop-sort-control"
                      className="text-sm font-medium text-gray-700"
                    >
                      Sort by
                    </label>
                    <Dropdown
                      label="Sort by"
                      options={SORT_OPTIONS}
                      value={currentSortBy}
                      onChange={(value) => {
                        if (value) {
                          handleSortChange(value as SortByOption);
                        }
                      }}
                      clearable={false}
                      className="min-w-[210px] bg-gray-100 font-medium text-gray-800"
                    />
                  </div>
                </div>
              </div>

              {isCatalogBootstrapping && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-3 lg:gap-8">
                  {[...Array(8)].map((_, index) => (
                    <div
                      key={index}
                      className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm animate-pulse"
                    >
                      <div className="h-48 bg-gray-200 lg:h-56"></div>
                      <div className="space-y-3 p-4 lg:p-5">
                        <div className="h-4 rounded bg-gray-200 lg:h-5"></div>
                        <div className="h-4 w-2/3 rounded bg-gray-200 lg:h-5"></div>
                        <div className="h-6 w-1/2 rounded bg-gray-200 lg:h-7"></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {displayError && (
                <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center shadow-sm">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                    <Package size={32} className="text-red-500" />
                  </div>
                  <h3 className="mb-2 type-h4 text-gray-900">
                    Error loading products
                  </h3>
                  <p className="mb-2 text-gray-600">
                    {(() => {
                      const err = displayError as any;
                      const message =
                        err?.networkError?.message ||
                        err?.graphQLErrors?.[0]?.message ||
                        err?.message ||
                        "";
                      if (/failed to fetch|fetch failed|network/i.test(String(message))) {
                        return "Catalog is temporarily unavailable. Retrying automatically.";
                      }
                      if (message) return message;
                      return "Unable to load products";
                    })()}
                  </p>
                  <p className="mb-6 text-sm text-gray-500">
                    Please try again or adjust your filters.
                  </p>
                  <button
                    onClick={() => {
                      if (backendReady) {
                        void refetch();
                      }
                    }}
                    className="btn-primary"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {noProductsFound && (
                <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center shadow-sm">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                    <Package size={32} className="text-gray-400" />
                  </div>
                  <h3 className="mb-2 type-h4 text-gray-900">
                    No products found
                  </h3>
                  <p className="mb-6 text-gray-600">
                    Try adjusting your filters or search terms.
                  </p>
                  <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <button onClick={handleReset} className="btn-primary">
                      Clear All Filters
                    </button>
                    {hasMore && (
                      <button
                        onClick={handleShowMore}
                        disabled={isFetchingMore}
                        className="btn-secondary"
                      >
                        {isFetchingMore ? (
                          <>
                            <MiniSpinner size={16} />
                          </>
                        ) : (
                          "Load More Catalog"
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!noProductsFound && (loading ? displayedProducts.length > 0 : true) && (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-3 lg:gap-8">
                    {rankedAndSortedProducts.map(
                      (product: Product, index: number) => (
                        <motion.div
                          key={product.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25, delay: index * 0.04 }}
                        >
                          <ProductCard product={product} />
                        </motion.div>
                      )
                    )}
                  </div>

                  {hasMore && (
                    <div className="mt-12 pb-8 text-center">
                      {isFetchingMore ? (
                        <div className="flex items-center justify-center gap-3">
                          <MiniSpinner size={22} />
                          <LoadingDots label="Loading" />
                        </div>
                      ) : (
                        <button
                          onClick={handleShowMore}
                          disabled={isFetchingMore}
                          className="btn-primary h-12 px-8 text-base"
                        >
                          Load More Products
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </div>

        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 26, stiffness: 280 }}
                onClick={(event) => event.stopPropagation()}
                className="h-full w-[92vw] max-w-sm bg-white shadow-2xl"
              >
                <ProductFilters
                  initialFilters={urlFilters}
                  currentSortBy={currentSortBy}
                  onFilterChange={updateFilters}
                  isMobile
                  onCloseMobile={() => setSidebarOpen(false)}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MainLayout>
  );
};

export default ShopPageClient;
