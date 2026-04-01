"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, X, Clock, ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import useStorage from "@/app/hooks/state/useStorage";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useGetAllProductsQuery } from "@/app/store/apis/ProductApi";
import { Product } from "@/app/types/productTypes";
import useFormatPrice from "@/app/hooks/ui/useFormatPrice";
import { useBackendReady } from "@/app/hooks/network/useBackendReady";
import { getProductListingPriceSummary } from "@/app/lib/productPricing";
import { beginNavigationActivity } from "@/app/lib/activityIndicator";
import LoadingDots from "@/app/components/feedback/LoadingDots";

type SearchFormValues = {
  searchQuery: string;
};

interface SearchBarProps {
  placeholder?: string;
}

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

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

const getVariantMinPrice = (product: Product) => {
  const { effectivePrice } = getProductListingPriceSummary(product);
  return effectivePrice > 0 ? effectivePrice : Number.POSITIVE_INFINITY;
};

const getSearchResultPriceLabel = (
  product: Product,
  formatPrice: (value: number) => string
) => {
  const { dealerPrice, effectivePrice, shouldLabelAsFrom } =
    getProductListingPriceSummary(product);
  const resolvedPrice = dealerPrice ?? effectivePrice;
  if (!Number.isFinite(resolvedPrice) || resolvedPrice <= 0) {
    return "";
  }

  if (dealerPrice !== null) {
    return shouldLabelAsFrom
      ? `Dealer from ${formatPrice(dealerPrice)}`
      : `Dealer ${formatPrice(dealerPrice)}`;
  }

  return shouldLabelAsFrom
    ? `From ${formatPrice(effectivePrice)}`
    : formatPrice(effectivePrice);
};

const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = "Search products, categories, or SKU",
}) => {
  const { register, handleSubmit, setValue, watch } = useForm<SearchFormValues>(
    {
      defaultValues: {
        searchQuery: "",
      },
    }
  );

  const [recentQueries, setRecentQueries] = useStorage<string[]>(
    "recentQueries",
    []
  );
  const [isFocused, setIsFocused] = useState(false);
  const [isHoveringDropdown, setIsHoveringDropdown] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const formRef = useRef<HTMLFormElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchQuery = watch("searchQuery");
  const router = useRouter();
  const formatPrice = useFormatPrice();
  const backendReady = useBackendReady();

  const normalizedSearchQuery = searchQuery.trim();

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(normalizedSearchQuery);
    }, 140);

    return () => clearTimeout(timeoutId);
  }, [normalizedSearchQuery]);

  const shouldSearch = debouncedQuery.length > 0;

  const { data: searchProductsData, isLoading: isSearching } = useGetAllProductsQuery(
    { searchQuery: debouncedQuery, limit: "48" },
    { skip: !shouldSearch || !backendReady }
  );

  const rankedProducts = useMemo(() => {
    if (!shouldSearch) {
      return [];
    }

    const products = (searchProductsData?.products || []) as Product[];
    const rows = products
      .map((product) => ({
        product,
        score: getSearchScore(product, debouncedQuery),
      }))
      .filter((row) => row.score > 0);

    rows.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const leftPrice = getVariantMinPrice(left.product);
      const rightPrice = getVariantMinPrice(right.product);
      if (leftPrice !== rightPrice) {
        return leftPrice - rightPrice;
      }

      return left.product.name.localeCompare(right.product.name);
    });

    return rows.slice(0, 8).map((row) => row.product);
  }, [debouncedQuery, searchProductsData?.products, shouldSearch]);

  const persistQuery = (query: string) => {
    if (!query || recentQueries.includes(query)) {
      return;
    }

    setRecentQueries([query, ...recentQueries.slice(0, 4)]);
  };

  const handleSearch = (data: SearchFormValues) => {
    const query = data.searchQuery.trim();
    if (query) {
      persistQuery(query);
      beginNavigationActivity();
      router.push(`/shop?search=${encodeURIComponent(query)}`);
    }

    setIsFocused(false);
  };

  const handleSelectRecentQuery = (query: string) => {
    setValue("searchQuery", query);
    setTimeout(() => handleSubmit(handleSearch)(), 100);
  };

  const handleSelectProduct = (product: Product) => {
    persistQuery(product.name);
    setIsFocused(false);
    beginNavigationActivity();
    router.push(`/product/${product.slug}`);
  };

  const clearSearch = () => {
    setValue("searchQuery", "");
    if (inputRef.current) inputRef.current.focus();
  };

  const removeRecentQuery = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newQueries = [...recentQueries];
    newQueries.splice(index, 1);
    setRecentQueries(newQueries);
  };

  const showSearchResults = isFocused || isHoveringDropdown;
  const hasQuery = normalizedSearchQuery.length > 0;
  const field = register("searchQuery");

  return (
    <div className="relative w-full max-w-xl">
      <form
        ref={formRef}
        onSubmit={handleSubmit(handleSearch)}
        className="relative"
      >
        <div className="flex items-center">
          <div className="relative flex items-center w-full">
            <span className="absolute left-3 text-primary transition-all duration-300">
              <Search
                className={`transition-all duration-300 ${
                  isFocused ? "text-primary" : "text-gray-400"
                }`}
                size={18}
              />
            </span>
            <input
              type="text"
              placeholder={placeholder}
              className="w-full py-2.5 pl-10 pr-12 bg-white rounded-full text-gray-800 placeholder-gray-600 border-2 border-gray-200
               focus:border-secondary focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm transition-all duration-200 hover:border-gray-300"
              {...field}
              onFocus={() => setIsFocused(true)}
              ref={(element) => {
                inputRef.current = element;
                field.ref(element);
              }}
              autoComplete="off"
            />
            <AnimatePresence>
              {searchQuery && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-12 p-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all duration-200"
                >
                  <X size={14} />
                </motion.button>
              )}
            </AnimatePresence>
            <button
              type="submit"
              className="absolute right-2 p-1.5 rounded-full bg-primary text-white transition-all duration-300"
            >
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </form>

      <AnimatePresence>
        {showSearchResults && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="absolute w-full mt-2 bg-white rounded-lg shadow-xl z-[1000] border border-gray-100 overflow-hidden"
            onMouseEnter={() => setIsHoveringDropdown(true)}
            onMouseLeave={() => setIsHoveringDropdown(false)}
          >
            {hasQuery ? (
              <div className="p-2">
                <div className="px-2 py-2 flex items-center justify-between border-b border-gray-100 mb-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Product matches
                  </p>
                  {isSearching && (
                    <div className="inline-flex items-center gap-1 text-xs text-gray-500">
                      <LoadingDots label="Searching" />
                    </div>
                  )}
                </div>

                {!isSearching && rankedProducts.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-gray-500">
                    No matches found for &quot;{normalizedSearchQuery}&quot;.
                  </p>
                ) : (
                  <ul className="space-y-1 max-h-80 overflow-y-auto">
                    {rankedProducts.map((product) => {
                      const minPrice = getVariantMinPrice(product);
                      const priceLabel = getSearchResultPriceLabel(
                        product,
                        formatPrice
                      );
                      return (
                        <li key={product.id}>
                          <button
                            type="button"
                            onClick={() => handleSelectProduct(product)}
                            className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-50 transition-colors"
                          >
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {product.name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {product.category?.name || "Uncategorized"}{" "}
                              {Number.isFinite(minPrice)
                                ? `- ${priceLabel || formatPrice(minPrice)}`
                                : ""}
                            </p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : (
              recentQueries.length > 0 && (
                <div className="p-3 border-b border-gray-100">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <div className="flex items-center text-gray-500">
                      <Clock size={14} className="mr-2" />
                      <span className="font-medium">Recent Searches</span>
                    </div>
                    <button
                      className="text-xs text-text font-medium"
                      onClick={() => setRecentQueries([])}
                    >
                      Clear all
                    </button>
                  </div>
                  <ul className="grid grid-cols-3 gap-2">
                    {recentQueries.map((query, index) => (
                      <li
                        key={index}
                        className="flex justify-between items-center py-1 px-2 cursor-pointer hover:bg-gray-50 rounded-md text-gray-700 group transition-all duration-200"
                        onClick={() => handleSelectRecentQuery(query)}
                      >
                        <div className="flex items-center overflow-hidden">
                          <Search
                            size={12}
                            className="mr-2 text-gray-400 flex-shrink-0"
                          />
                          <span className="text-sm truncate">{query}</span>
                        </div>
                        <button
                          onClick={(e) => removeRecentQuery(index, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded-full transition-opacity duration-200 flex-shrink-0"
                        >
                          <X size={12} className="text-gray-500" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SearchBar;
