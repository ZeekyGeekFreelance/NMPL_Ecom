"use client";

import React from "react";
import {
  Search,
  X,
  ArrowRight,
  FileText,
  User,
  ShoppingCart,
  FolderOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

interface SearchResult {
  type: "product" | "category" | "user" | "transaction";
  id: string;
  title: string;
  description?: string;
}

interface SearchModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  query: string;
  setQuery: (query: string) => void;
  placeholder: string;
  searchResults: SearchResult[];
  isLoading: boolean;
  error: any;
}

const ROUTES = {
  transaction: (id: string) => `/dashboard/transactions/${id}`,
  product: (id: string) => `/dashboard/products/${id}`,
  category: () => "/dashboard/categories",
  user: () => "/dashboard/users",
};

const TYPE_ICONS = {
  transaction: <ShoppingCart size={16} />,
  product: <FileText size={16} />,
  category: <FolderOpen size={16} />,
  user: <User size={16} />,
};

const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  setIsOpen,
  query,
  setQuery,
  placeholder,
  searchResults,
  isLoading,
  error,
}) => {
  const router = useRouter();

  const handleResultClick = (result: SearchResult): void => {
    const route = ROUTES[result.type](result.id);
    router.push(route);
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-24 backdrop-blur-sm sm:pt-32"
          onClick={() => setIsOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -20 }}
            transition={{
              duration: 0.2,
              type: "spring",
              stiffness: 350,
              damping: 25,
            }}
            className="w-full max-w-lg overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative flex items-center border-b border-gray-100">
              <Search className="absolute left-4 text-gray-400" size={18} />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={placeholder}
                className="w-full py-4 pl-12 pr-12 text-sm text-gray-800 focus:outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="absolute right-4 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close search"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-96 overflow-x-hidden overflow-y-auto">
              {error ? (
                <div className="flex items-center gap-2 p-4 text-sm text-red-500">
                  <X size={16} className="flex-shrink-0" />
                  <span>Error: Unable to fetch results. Please try again.</span>
                </div>
              ) : isLoading ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-gray-500">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
                  <span className="text-sm">Searching...</span>
                </div>
              ) : !query.trim() ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  <Search size={24} className="mx-auto mb-2 opacity-40" />
                  <p>Start typing to search across dashboard</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-500">
                  <Search size={24} className="mx-auto mb-2 opacity-40" />
                  <p>No results found for &quot;{query}&quot;</p>
                </div>
              ) : (
                <div className="py-2">
                  {searchResults.map((result, index) => (
                    <motion.div
                      key={`${result.type}-${result.id}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15, delay: index * 0.03 }}
                      className="group flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-gray-50"
                      onClick={() => handleResultClick(result)}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex-shrink-0 rounded-md bg-gray-100 p-2 text-gray-500 transition-colors group-hover:bg-teal-100 group-hover:text-teal-600">
                          {TYPE_ICONS[result.type]}
                        </div>
                        <div className="truncate">
                          <p className="truncate text-sm font-medium text-gray-800">
                            {result.title}
                          </p>
                          {result.description && (
                            <p className="truncate text-xs text-gray-500">
                              {result.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                          {result.type}
                        </span>
                        <ArrowRight
                          size={16}
                          className="text-gray-400 opacity-0 transition-opacity group-hover:opacity-100"
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SearchModal;
