"use client";

import React from "react";
import { RefreshCw } from "lucide-react";

interface TableHeaderProps {
  title?: string;
  subtitle?: string;
  totalResults?: number;
  currentPage?: number;
  resultsPerPage?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const TableHeader: React.FC<TableHeaderProps> = ({
  title,
  subtitle,
  totalResults,
  currentPage,
  resultsPerPage,
  onRefresh,
  isRefreshing = false,
}) => {
  return (
    <div className="border-b border-blue-100 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {(title || subtitle) && (
          <div className="min-w-0">
            {title && (
              <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
            )}
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
        )}

        <div className="flex items-center gap-3 self-start sm:self-center">
          <p className="text-sm text-gray-700">
            Showing {totalResults !== undefined ? totalResults : 0} results
            {currentPage ? ` (Page ${currentPage})` : ""}
            {totalResults !== undefined && totalResults > 0 && resultsPerPage
              ? `, ${resultsPerPage} per page`
              : ""}
          </p>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className={`group btn-secondary h-10 w-10 border-2 border-blue-200 p-0 font-bold text-blue-700 shadow-sm transition-all hover:bg-blue-200 ${
                isRefreshing ? "bg-blue-200 text-blue-900 shadow-md" : "bg-blue-100/80"
              }`}
              aria-label="Refresh table data"
              aria-busy={isRefreshing}
            >
              <RefreshCw
                size={18}
                strokeWidth={2.6}
                className={
                  isRefreshing
                    ? "animate-[spin_0.7s_linear_infinite]"
                    : "transition-transform duration-200 group-hover:rotate-45"
                }
              />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TableHeader;
