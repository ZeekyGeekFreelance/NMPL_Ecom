"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Package, Filter, X } from "lucide-react";
import { Product } from "@/app/types/productTypes";
import ProductCard from "../product/ProductCard";
import MainLayout from "@/app/components/templates/MainLayout";
import Dropdown from "@/app/components/molecules/Dropdown";
import ProductFilters from "./ProductFilters";
import { useMediaQuery } from "@/app/hooks/useMediaQuery";
import { getProductListingPriceSummary } from "@/app/lib/productPricing";
import {
  DEFAULT_SORT,
  FilterValues,
  buildShopFiltersFromReader,
  getShopRequestPageSize,
  SortByOption,
} from "./shopShared";
import type { ProductConnectionPayload } from "@/app/lib/serverProductQueries";
import MiniSpinner from "@/app/components/feedback/MiniSpinner";
import { useGetAllProductsQuery } from "@/app/store/apis/ProductApi";
import SkeletonLoader from "@/app/components/feedback/SkeletonLoader";

const SORT_OPTIONS: Array<{ label: string; value: SortByOption }> = [
  { label: "Relevance", value: "RELEVANCE" },
  { label: "Price: Low to High", value: "PRICE_ASC" },
  { label: "Price: High to Low", value: "PRICE_DESC" },
  { label: "Name: A to Z", value: "NAME_ASC" },
];

const sortProducts = (products: Product[], sortBy: SortByOption): Product[] => {
  const sorted = [...products];
  switch (sortBy) {
    case "PRICE_ASC":
      return sorted.sort((a, b) => {
        const pa = getProductListingPriceSummary(a).effectivePrice;
        const pb = getProductListingPriceSummary(b).effectivePrice;
        return pa - pb;
      });
    case "PRICE_DESC":
      return sorted.sort((a, b) => {
        const pa = getProductListingPriceSummary(a).effectivePrice;
        const pb = getProductListingPriceSummary(b).effectivePrice;
        return pb - pa;
      });
    case "NAME_ASC":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return sorted;
  }
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
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [allProducts, setAllProducts] = useState<Product[]>(initialConnection.products);

  const urlFilters = useMemo(
    () => buildShopFiltersFromReader((key) => searchParams.get(key) ?? undefined),
    [searchParams]
  );

  const [filters, setFilters] = useState<FilterValues>({ ...serverInitialFilters, ...urlFilters });
  const currentSortBy = (filters.sortBy || DEFAULT_SORT) as SortByOption;
  const pageSize = getShopRequestPageSize(filters);

  // Build query params
  const queryParams = useMemo(() => {
    const p: Record<string, string> = {
      limit: String(pageSize),
      page: String(page),
    };
    if (filters.search) p.searchQuery = filters.search;
    if (filters.categoryId) p.category = filters.categoryId;
    if (filters.isFeatured) p.featured = "true";
    if (filters.isBestSeller) p.bestselling = "true";
    if (filters.isNew) p.isNew = "true";
    if (filters.isTrending) p.isTrending = "true";
    return p;
  }, [filters, page, pageSize]);

  const { data, isLoading, error } = useGetAllProductsQuery(queryParams, {
    skip: page === 1 && !initialConnection.isFallback && allProducts.length > 0 && page === 1,
  });

  useEffect(() => {
    if (data?.products) {
      if (page === 1) {
        setAllProducts(sortProducts(data.products, currentSortBy));
      } else {
        setAllProducts((prev) => [...prev, ...sortProducts(data.products, currentSortBy)]);
      }
    }
  }, [data]);

  const hasMore = data?.hasMore ?? initialConnection.hasMore;
  const totalCount = data?.totalCount ?? initialConnection.totalCount;

  const handleFilterChange = useCallback((newFilters: FilterValues) => {
    setFilters(newFilters);
    setPage(1);
    setAllProducts([]);
  }, []);

  const sortedProducts = useMemo(() => sortProducts(allProducts, currentSortBy), [allProducts, currentSortBy]);

  const activeFilterCount = Object.entries(filters).filter(([k, v]) =>
    k !== "sortBy" && v !== undefined && v !== "" && v !== false
  ).length;

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Shop</h1>
                {totalCount !== null && (
                  <p className="text-sm text-gray-500 mt-0.5">{totalCount} products</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Dropdown
                  value={currentSortBy}
                  onChange={(val) => handleFilterChange({ ...filters, sortBy: val as SortByOption })}
                  options={SORT_OPTIONS}
                  label="Sort by"
                  className="w-48"
                />
                {!isDesktop && (
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="relative flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Filter size={16} />
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex gap-6">
            {/* Sidebar - desktop */}
            {isDesktop && (
              <aside className="w-64 flex-shrink-0">
                <ProductFilters
                  initialFilters={filters}
                  onFilterChange={handleFilterChange}
                />
              </aside>
            )}

            {/* Mobile sidebar */}
            <AnimatePresence>
              {sidebarOpen && !isDesktop && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex"
                >
                  <div
                    className="absolute inset-0 bg-black/50"
                    onClick={() => setSidebarOpen(false)}
                  />
                  <motion.aside
                    initial={{ x: "-100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "-100%" }}
                    transition={{ type: "tween" }}
                    className="relative z-10 w-72 bg-white h-full overflow-y-auto p-4"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-semibold text-gray-900">Filters</h2>
                      <button onClick={() => setSidebarOpen(false)}>
                        <X size={20} />
                      </button>
                    </div>
                    <ProductFilters
                      initialFilters={filters}
                      onFilterChange={(f) => { handleFilterChange(f); setSidebarOpen(false); }}
                    />
                  </motion.aside>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Products grid */}
            <div className="flex-1">
              {isLoading && page === 1 ? (
                <SkeletonLoader />
              ) : error ? (
                <div className="text-center py-12">
                  <p className="text-red-500">Failed to load products. Please try again.</p>
                </div>
              ) : sortedProducts.length === 0 ? (
                <div className="text-center py-20">
                  <Package size={64} className="mx-auto text-gray-300 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700">No products found</h3>
                  <p className="text-gray-500 mt-2">Try adjusting your filters</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {sortedProducts.map((product, i) => (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.03 }}
                      >
                        <ProductCard product={product} />
                      </motion.div>
                    ))}
                  </div>

                  {hasMore && (
                    <div className="mt-8 text-center">
                      <button
                        onClick={() => setPage((p) => p + 1)}
                        disabled={isLoading}
                        className="bg-primary text-white px-8 py-3 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 mx-auto"
                      >
                        {isLoading ? <MiniSpinner size={16} /> : null}
                        Load More
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default ShopPageClient;
