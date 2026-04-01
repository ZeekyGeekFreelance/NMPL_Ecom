"use client";
import React, { useState, useMemo } from "react";
import { Search, Loader2 } from "lucide-react";
import { debounce } from "lodash";
import { useGetAllProductsQuery } from "@/app/store/apis/ProductApi";

interface DashboardSearchBarProps {
  placeholder?: string;
  className?: string;
}

const DashboardSearchBar: React.FC<DashboardSearchBarProps> = ({
  placeholder = "Search dashboard records",
  className = "",
}) => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const { data, isLoading: loading } = useGetAllProductsQuery(
    { searchQuery: debouncedQuery, limit: "10" },
    { skip: !debouncedQuery || debouncedQuery.length < 2 }
  );

  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setDebouncedQuery(value.trim().toLowerCase());
      }, 300),
    []
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    debouncedSearch(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setQuery("");
      setDebouncedQuery("");
    }
  };

  // Map to simple display list
  const results = data?.products?.slice(0, 5) ?? [];

  return (
    <div className={`relative ${className}`}>
      <div className="relative flex items-center">
        {loading ? (
          <Loader2 className="absolute left-3 h-4 w-4 animate-spin text-gray-400" />
        ) : (
          <Search className="absolute left-3 h-4 w-4 text-gray-400" />
        )}
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-700 outline-none focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary"
        />
      </div>

      {query.length >= 2 && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {results.map((p: any) => (
            <a
              key={p.id}
              href={`/dashboard/products/${p.id}`}
              className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100 last:border-0"
            >
              <Search size={14} className="text-gray-400 shrink-0" />
              <span className="truncate">{p.name}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default DashboardSearchBar;
