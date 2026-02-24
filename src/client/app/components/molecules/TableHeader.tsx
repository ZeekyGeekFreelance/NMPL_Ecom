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
}

const TableHeader: React.FC<TableHeaderProps> = ({
  title,
  subtitle,
  totalResults,
  currentPage,
  resultsPerPage,
  onRefresh,
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
              className="rounded-lg bg-blue-50 p-2 text-blue-600 transition-colors hover:bg-blue-100"
              aria-label="Refresh table data"
            >
              <RefreshCw size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TableHeader;

