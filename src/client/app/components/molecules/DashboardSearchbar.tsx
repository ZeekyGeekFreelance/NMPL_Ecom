"use client";
import React, { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { Search, Loader2 } from "lucide-react";
import { useLazyQuery } from "@apollo/client";
import { debounce } from "lodash";
import { SEARCH_DASHBOARD } from "@/app/gql/Dashboard";

// Code split the SearchModal component
const SearchModal = lazy(() => import("./SearchModal"));

interface DashboardSearchBarProps {
  placeholder?: string;
  className?: string;
}

const DashboardSearchBar: React.FC<DashboardSearchBarProps> = ({
  placeholder = "Search dashboard records",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // GraphQL Lazy Query
  const [searchDashboard, { data, loading, error }] =
    useLazyQuery(SEARCH_DASHBOARD);

  const normalizeQuery = (value: string) =>
    value
      .trim()
      .replace(/\s+/g, " ");

  // Debounced search function
  const debouncedSearch = useMemo(
    () =>
      debounce((searchQuery: string) => {
        setIsLoading(true);
        searchDashboard({
          variables: {
            params: {
              searchQuery,
            },
          },
        }).finally(() => setIsLoading(false));
      }, 300),
    [searchDashboard]
  );

  // Trigger search when query changes
  useEffect(() => {
    const normalized = normalizeQuery(query);

    if (isOpen && normalized.length > 0) {
      debouncedSearch(normalized);
    } else {
      setIsLoading(false);
    }

    return () => debouncedSearch.cancel();
  }, [query, isOpen, debouncedSearch]);

  // Clear query when closing
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200
           hover:border-gray-300 transition-all ${className}`}
        aria-label="Open dashboard search"
      >
        <Search size={18} className="text-gray-400 group-hover:text-gray-600" />
        <span className="text-sm text-gray-500 hidden sm:inline">
          {placeholder}
        </span>
      </button>

      {isOpen && (
        <Suspense fallback={<SearchFallback />}>
          <SearchModal
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            query={query}
            setQuery={setQuery}
            placeholder={placeholder}
            searchResults={data?.searchDashboard || []}
            isLoading={loading || isLoading}
            error={error}
          />
        </Suspense>
      )}
    </>
  );
};

const SearchFallback = () => (
  <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-4 border border-gray-100 flex items-center justify-center py-10">
      <Loader2 className="animate-spin text-gray-400" size={32} />
    </div>
  </div>
);

export default DashboardSearchBar;
