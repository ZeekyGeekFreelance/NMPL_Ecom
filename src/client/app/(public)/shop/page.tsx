"use client";
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@apollo/client";
import { motion, AnimatePresence } from "framer-motion";
import { Package, Filter, Loader2 } from "lucide-react";
import { GET_PRODUCTS } from "@/app/gql/Product";
import { Product } from "@/app/types/productTypes";
import ProductCard from "../product/ProductCard";
import MainLayout from "@/app/components/templates/MainLayout";
import Dropdown from "@/app/components/molecules/Dropdown";
import ProductFilters, {
  FilterValues,
  SortByOption,
} from "./ProductFilters";
import { useDealerCatalogPollInterval } from "@/app/hooks/network/useDealerCatalogPollInterval";
import { useMediaQuery } from "@/app/hooks/useMediaQuery";

const DEFAULT_SORT: SortByOption = "RELEVANCE";
const BASE_PAGE_SIZE = 12;
const SEARCH_PAGE_SIZE = 48;

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

const getVariantMinPrice = (product: Product) => {
  const listingDealerMinPrice = Number(product.dealerMinPrice);
  if (Number.isFinite(listingDealerMinPrice) && listingDealerMinPrice > 0) {
    return listingDealerMinPrice;
  }

  const listingMinPrice = Number(product.minPrice);
  if (Number.isFinite(listingMinPrice) && listingMinPrice > 0) {
    return listingMinPrice;
  }

  const listingPrice = Number(product.price);
  if (Number.isFinite(listingPrice) && listingPrice > 0) {
    return listingPrice;
  }

  const prices = product.variants?.map((variant) => Number(variant.price)) || [];
  if (!prices.length) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.min(...prices);
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

const ShopPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const initialFilters = useMemo<FilterValues>(
    () => ({
      search: searchParams.get("search") || "",
      sortBy:
        (searchParams.get("sortBy") as SortByOption | null) || DEFAULT_SORT,
      isNew: searchParams.get("isNew") === "true" || undefined,
      isFeatured: searchParams.get("isFeatured") === "true" || undefined,
      isTrending: searchParams.get("isTrending") === "true" || undefined,
      isBestSeller: searchParams.get("isBestSeller") === "true" || undefined,
      minPrice: searchParams.get("minPrice")
        ? parseFloat(searchParams.get("minPrice")!)
        : undefined,
      maxPrice: searchParams.get("maxPrice")
        ? parseFloat(searchParams.get("maxPrice")!)
        : undefined,
      categoryId: searchParams.get("categoryId") || undefined,
    }),
    [searchParams]
  );

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filters, setFilters] = useState<FilterValues>(initialFilters);
  const [displayedProducts, setDisplayedProducts] = useState<Product[]>([]);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const requestPageSize = filters.search?.trim()
    ? SEARCH_PAGE_SIZE
    : BASE_PAGE_SIZE;

  const dealerCatalogPollInterval = useDealerCatalogPollInterval(skip === 0);
  const currentSortBy = (filters.sortBy || DEFAULT_SORT) as SortByOption;

  const serverFilters = useMemo(
    () => ({
      search: filters.search?.trim() || undefined,
      categoryId: filters.categoryId,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      isNew: filters.isNew,
      isFeatured: filters.isFeatured,
      isTrending: filters.isTrending,
      isBestSeller: filters.isBestSeller,
    }),
    [
      filters.search,
      filters.categoryId,
      filters.minPrice,
      filters.maxPrice,
      filters.isNew,
      filters.isFeatured,
      filters.isTrending,
      filters.isBestSeller,
    ]
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
  } = useQuery(GET_PRODUCTS, {
    variables: { first: requestPageSize, skip: 0, filters: serverFilters },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    pollInterval: dealerCatalogPollInterval,
  });

  // Sync query results into display state.  Using a useEffect instead of
  // onCompleted avoids stale-closure issues when filters change rapidly and
  // ensures we never regress to an empty list while a background refetch is
  // in-flight (the previous data stays visible until new data arrives).
  useEffect(() => {
    const fresh = queryData?.products;
    if (!fresh) return;
    setDisplayedProducts(fresh.products);
    setHasMore(fresh.hasMore);
    setSkip(0);
  }, [queryData]);

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

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
      if (nextFilters.minPrice) {
        query.set("minPrice", nextFilters.minPrice.toString());
      }
      if (nextFilters.maxPrice) {
        query.set("maxPrice", nextFilters.maxPrice.toString());
      }
      if (nextFilters.categoryId) {
        query.set("categoryId", nextFilters.categoryId);
      }

      const nextQuery = query.toString();
      router.replace(nextQuery ? `/shop?${nextQuery}` : "/shop");
    },
    [router]
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
    router.replace("/shop");
  }, [router]);

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
    rankedAndSortedProducts.length === 0 && !loading && !error;

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 pt-0 pb-6 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="flex gap-6 lg:gap-8">
            <div className="hidden lg:block lg:w-[320px] lg:self-stretch xl:w-[360px]">
              <ProductFilters
                initialFilters={initialFilters}
                currentSortBy={currentSortBy}
                onFilterChange={updateFilters}
              />
            </div>

            <section className="min-w-0 flex-1">
              <div className="sticky top-24 z-20 -mx-6 mb-5 rounded-lg border border-gray-200 bg-white p-3 shadow-sm sm:mx-0 sm:top-[9.125rem] sm:rounded-xl sm:p-4">
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
                      <span className="font-semibold text-gray-900">
                        {rankedAndSortedProducts.length}
                      </span>{" "}
                      products found
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

              {loading && !displayedProducts.length && (
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

              {error && (
                <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center shadow-sm">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                    <Package size={32} className="text-red-500" />
                  </div>
                  <h3 className="mb-2 type-h4 text-gray-900">
                    Error loading products
                  </h3>
                  <p className="mb-6 text-gray-600">
                    Please try again or adjust your filters.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
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
                            <Loader2 size={16} className="animate-spin" />
                            Loading...
                          </>
                        ) : (
                          "Load More Catalog"
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!noProductsFound && !loading && (
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
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
                          <span className="text-gray-600">
                            Loading more products...
                          </span>
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
                  initialFilters={initialFilters}
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

export default ShopPage;
