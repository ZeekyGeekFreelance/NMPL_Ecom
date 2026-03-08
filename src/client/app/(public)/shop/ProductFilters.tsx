"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { X, SlidersHorizontal, ChevronDown, Search, Loader2 } from "lucide-react";
import { useLazyQuery } from "@apollo/client";
import { GET_CATEGORIES_SEARCH } from "@/app/gql/Product";
import Dropdown from "@/app/components/molecules/Dropdown";
import CheckBox from "@/app/components/atoms/CheckBox";
import { debounce } from "lodash";

export type SortByOption =
  | "RELEVANCE"
  | "PRICE_ASC"
  | "PRICE_DESC"
  | "NAME_ASC";

export interface FilterValues {
  search: string;
  sortBy?: SortByOption;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  isNew?: boolean;
  isFeatured?: boolean;
  isTrending?: boolean;
  isBestSeller?: boolean;
}

interface ProductFiltersProps {
  initialFilters: FilterValues;
  currentSortBy?: SortByOption;
  onFilterChange: (filters: FilterValues) => void;
  // `categories` prop is kept for backward-compat but is no longer used
  // for the filter dropdown — the dropdown now lazy-searches server-side.
  categories?: Array<{ id: string; name: string }>;
  isMobile?: boolean;
  onCloseMobile?: () => void;
}

// ── Searchable category dropdown ─────────────────────────────────────────────
// Replaces the static flat list. Fires a server-side search on each keystroke
// (debounced 250 ms). Works correctly with 1 330+ categories.
interface CategorySearchDropdownProps {
  value: string | undefined;
  onChange: (id: string | undefined) => void;
}

const CATEGORY_FETCH_LIMIT = 50;

const CategorySearchDropdown: React.FC<CategorySearchDropdownProps> = ({
  value,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("All Categories");
  const containerRef = useRef<HTMLDivElement>(null);

  const [fetchCategories, { data, loading }] = useLazyQuery(
    GET_CATEGORIES_SEARCH,
    { fetchPolicy: "cache-and-network" }
  );

  const debouncedFetch = useMemo(
    () =>
      debounce((q: string) => {
        fetchCategories({
          variables: { search: q || undefined, first: CATEGORY_FETCH_LIMIT },
        });
      }, 250),
    [fetchCategories]
  );

  // Fetch on open (empty search = first 50 alphabetically)
  useEffect(() => {
    if (open) {
      debouncedFetch("");
    }
  }, [debouncedFetch, open]);

  useEffect(() => {
    return () => debouncedFetch.cancel();
  }, [debouncedFetch]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleSearch = (q: string) => {
    setSearchInput(q);
    debouncedFetch(q);
  };

  const handleSelect = (id: string, name: string) => {
    onChange(id || undefined);
    setSelectedLabel(id ? name : "All Categories");
    setOpen(false);
    setSearchInput("");
  };

  // When value is cleared externally, reset label
  useEffect(() => {
    if (!value) setSelectedLabel("All Categories");
  }, [value]);

  const results: Array<{ id: string; name: string }> = data?.categories ?? [];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm text-left text-gray-800 hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Search categories..."
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"
            />
            {loading && <Loader2 size={14} className="animate-spin text-gray-400 shrink-0" />}
          </div>

          {/* List */}
          <ul className="max-h-52 overflow-y-auto py-1">
            {/* "All" option */}
            <li>
              <button
                type="button"
                onClick={() => handleSelect("", "All Categories")}
                className={`w-full px-3.5 py-2.5 text-left text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors ${
                  !value ? "font-semibold text-indigo-700 bg-indigo-50" : "text-gray-700"
                }`}
              >
                All Categories
              </button>
            </li>
            {results.map((cat) => (
              <li key={cat.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(cat.id, cat.name)}
                  className={`w-full px-3.5 py-2.5 text-left text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors ${
                    value === cat.id ? "font-semibold text-indigo-700 bg-indigo-50" : "text-gray-700"
                  }`}
                >
                  {cat.name}
                </button>
              </li>
            ))}
            {!loading && results.length === 0 && (
              <li className="px-3.5 py-4 text-center text-sm text-gray-400">
                No categories found
              </li>
            )}
            {results.length === CATEGORY_FETCH_LIMIT && (
              <li className="px-3.5 py-2 text-center text-xs text-gray-400 border-t border-gray-100">
                Showing first {CATEGORY_FETCH_LIMIT} — type to search more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

const ProductFilters: React.FC<ProductFiltersProps> = ({
  initialFilters,
  onFilterChange,
  isMobile = false,
  onCloseMobile,
}) => {
  const normalizedInitialValues = useMemo<FilterValues>(
    () => ({
      search: initialFilters.search || "",
      sortBy: initialFilters.sortBy || "RELEVANCE",
      categoryId: initialFilters.categoryId,
      minPrice: initialFilters.minPrice,
      maxPrice: initialFilters.maxPrice,
      isNew: initialFilters.isNew,
      isFeatured: initialFilters.isFeatured,
      isTrending: initialFilters.isTrending,
      isBestSeller: initialFilters.isBestSeller,
    }),
    [
      initialFilters.search,
      initialFilters.sortBy,
      initialFilters.categoryId,
      initialFilters.minPrice,
      initialFilters.maxPrice,
      initialFilters.isNew,
      initialFilters.isFeatured,
      initialFilters.isTrending,
      initialFilters.isBestSeller,
    ]
  );

  const { control, watch, reset, handleSubmit, getValues } = useForm<FilterValues>({
    defaultValues: normalizedInitialValues,
  });

  // Watch form values
  const formValues = watch();

  // Debounced search update
  const debouncedSearch = useMemo(
    () =>
      debounce((searchValue: string) => {
        const currentValues = getValues();
        onFilterChange({ ...currentValues, search: searchValue });
      }, 300),
    [getValues, onFilterChange]
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  useEffect(() => {
    reset(normalizedInitialValues);
  }, [normalizedInitialValues, reset]);

  // Handle search input change
  const handleSearchChange = useCallback(
    (value: string) => {
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  // Handle form submission (Apply Filters)
  const onSubmit = (data: FilterValues) => {
    onFilterChange(data);
    if (isMobile && onCloseMobile) onCloseMobile();
  };

  // Reset all filters
  const handleReset = () => {
    reset({
      search: "",
      sortBy: "RELEVANCE",
      categoryId: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      isNew: undefined,
      isFeatured: undefined,
      isTrending: undefined,
      isBestSeller: undefined,
    });
    onFilterChange({
      search: "",
      sortBy: "RELEVANCE",
      categoryId: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      isNew: undefined,
      isFeatured: undefined,
      isTrending: undefined,
      isBestSeller: undefined,
    });
    if (isMobile && onCloseMobile) onCloseMobile();
  };

  const sortOptions = [
    { label: "Relevance", value: "RELEVANCE" },
    { label: "Price: Low to High", value: "PRICE_ASC" },
    { label: "Price: High to Low", value: "PRICE_DESC" },
    { label: "Name: A to Z", value: "NAME_ASC" },
  ];

  // Count active filters
  const activeFilterCount = Object.entries(formValues).filter(
    ([key, value]) => {
      if (key === "sortBy") {
        return value !== undefined && value !== "" && value !== "RELEVANCE";
      }
      return value !== undefined && value !== "" && value !== false;
    }
  ).length;

  return (
    <aside
      className={`bg-white rounded-xl shadow-sm border border-gray-100 ${
        isMobile
          ? "h-full w-full overflow-hidden rounded-none border-0 shadow-none"
          : "sticky top-[10.625rem] h-[calc(100dvh-10rem)] max-h-[calc(100dvh-10rem)] w-full overflow-hidden"
      }`}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex h-full min-h-0 flex-col"
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between border-b border-gray-100 ${
            isMobile ? "p-4" : "p-6 pb-4"
          } shrink-0`}
        >
          <div className="flex items-center gap-3">
            <SlidersHorizontal size={20} className="text-indigo-600" />
            <h2 className="font-bold text-gray-900 text-lg">Filter By</h2>
          </div>
          <div className="flex items-center gap-3">
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={handleReset}
                className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1.5 font-medium"
              >
                <X size={16} />
                Clear all
              </button>
            )}
            {isMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Filters Content */}
        <div
          className={`flex-1 min-h-0 space-y-6 ${
            isMobile ? "p-4" : "p-6 pt-4"
          } overflow-y-auto overscroll-y-contain`}
        >
          {/* Search */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-800">
              Search Products
            </label>
            <Controller
              name="search"
              control={control}
              render={({ field }) => (
                <input
                  type="text"
                  placeholder="Search products..."
                  className="w-full border border-gray-200 rounded-xl p-3.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                  {...field}
                  onChange={(e) => {
                    field.onChange(e);
                    handleSearchChange(e.target.value);
                  }}
                />
              )}
            />
          </div>

          {/* Sort */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-800">Sort By</label>
            <Controller
              name="sortBy"
              control={control}
              render={({ field }) => (
                <Dropdown
                  options={sortOptions}
                  value={field.value || "RELEVANCE"}
                  onChange={(value) =>
                    field.onChange((value as SortByOption) || "RELEVANCE")
                  }
                  className="w-full"
                />
              )}
            />
          </div>

          {/* Category */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-800">
              Category
            </label>
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <CategorySearchDropdown
                  value={field.value}
                  onChange={(id) => field.onChange(id)}
                />
              )}
            />
          </div>

          {/* Price Range */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-800">
              Price Range
            </label>
            <div className="flex items-center space-x-3">
              <Controller
                name="minPrice"
                control={control}
                render={({ field }) => (
                  <input
                    type="number"
                    placeholder="Min"
                    className="border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-gray-50 focus:bg-white w-1/2"
                    value={field.value || ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value ? parseFloat(e.target.value) : undefined
                      )
                    }
                  />
                )}
              />
              <Controller
                name="maxPrice"
                control={control}
                render={({ field }) => (
                  <input
                    type="number"
                    placeholder="Max"
                    className="border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-gray-50 focus:bg-white w-1/2"
                    value={field.value || ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value ? parseFloat(e.target.value) : undefined
                      )
                    }
                  />
                )}
              />
            </div>
          </div>

          {/* Product Flags */}
          <div className="space-y-4">
            <label className="text-sm font-semibold text-gray-800">
              Product Status
            </label>
            <div className="space-y-4 pl-1">
              <CheckBox name="isNew" control={control} label="New Arrivals" />
              <CheckBox
                name="isFeatured"
                control={control}
                label="Featured Products"
              />
              <CheckBox
                name="isTrending"
                control={control}
                label="Trending Now"
              />
              <CheckBox
                name="isBestSeller"
                control={control}
                label="Best Sellers"
              />
            </div>
          </div>
        </div>

        {/* Apply Filters Button */}
        <div
          className={`border-t border-gray-100 ${
            isMobile ? "p-4" : "p-6 pt-4"
          } shrink-0 bg-white`}
        >
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-3.5 rounded-xl hover:bg-indigo-700 transition-all duration-300 font-semibold shadow-sm hover:shadow-md"
          >
            Apply Filters
          </button>
        </div>
      </form>
    </aside>
  );
};

export default ProductFilters;
