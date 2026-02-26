"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import TableHeader from "../molecules/TableHeader";
import TableActions from "../molecules/TableActions";
import TableBody from "../molecules/TableBody";
import PaginationComponent from "../organisms/Pagination";
import { useRouter } from "next/navigation";
import useDebounce from "@/app/hooks/network/useDebounce";

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: any) => React.ReactNode;
  sortAccessor?: (row: any) => unknown;
  searchAccessor?: (row: any) => unknown;
  exportAccessor?: (row: any) => unknown;
  width?: string;
  align?: "left" | "center" | "right";
}

interface TableProps {
  data: any[];
  columns: Column[];
  isLoading?: boolean;
  emptyMessage?: string;
  title?: string;
  subtitle?: string;
  onRefresh?: () => void;
  showHeader?: boolean;
  showPaginationDetails?: boolean;
  showSearchBar?: boolean;
  totalPages?: number;
  totalResults?: number;
  resultsPerPage?: number;
  currentPage?: number;
  expandable?: boolean;
  expandedRowId?: string | null;
  renderExpandedRow?: (row: any) => React.ReactNode;
  className?: string;
  initialSortKey?: string | null;
  initialSortDirection?: "asc" | "desc";
}

const getNestedValue = (obj: any, key: string): any =>
  key
    .split(".")
    .reduce((acc, current) => (acc && acc[current] !== undefined ? acc[current] : null), obj);

const extractTextFromReactNode = (node: React.ReactNode): string => {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((child) => extractTextFromReactNode(child)).join(" ");
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractTextFromReactNode(node.props?.children);
  }

  return "";
};

const collectSearchableText = (value: unknown): string[] => {
  if (value === null || value === undefined) {
    return [];
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }

  if (value instanceof Date) {
    return [value.toISOString()];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectSearchableText);
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(collectSearchableText);
  }

  return [];
};

const normalizeString = (value: unknown): string =>
  String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const scoreFieldAgainstQuery = (fieldValue: string, query: string): number => {
  const value = normalizeString(fieldValue);
  if (!value || !query) {
    return 0;
  }

  if (value === query) return 150;
  if (value.startsWith(query)) return 120;
  if (value.includes(` ${query}`)) return 90;
  if (value.includes(query)) return 60;
  return 0;
};

const comparePrimitiveValues = (left: unknown, right: unknown): number => {
  if (left === right) return 0;

  if (left === null || left === undefined) return 1;
  if (right === null || right === undefined) return -1;

  const leftNumber = typeof left === "number" ? left : Number(left);
  const rightNumber = typeof right === "number" ? right : Number(right);
  const bothNumeric =
    Number.isFinite(leftNumber) &&
    Number.isFinite(rightNumber) &&
    String(left).trim() !== "" &&
    String(right).trim() !== "";

  if (bothNumeric) {
    return leftNumber - rightNumber;
  }

  const leftDate = Date.parse(String(left));
  const rightDate = Date.parse(String(right));
  const bothDates = !Number.isNaN(leftDate) && !Number.isNaN(rightDate);

  if (bothDates) {
    return leftDate - rightDate;
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base",
  });
};

const Table: React.FC<TableProps> = ({
  data,
  columns,
  isLoading = false,
  emptyMessage = "No data available",
  title,
  subtitle,
  onRefresh,
  showHeader = true,
  showSearchBar = true,
  showPaginationDetails = true,
  totalPages,
  totalResults,
  resultsPerPage,
  currentPage,
  expandable = false,
  expandedRowId = null,
  renderExpandedRow,
  className = "",
  initialSortKey = null,
  initialSortDirection = "asc",
}) => {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<string | null>(initialSortKey);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(
    initialSortDirection
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(columns.map((col) => col.key))
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const debouncedSearchQuery = useDebounce(searchQuery, 180);

  useEffect(() => {
    setVisibleColumns((previousVisibleColumns) => {
      const nextVisibleColumns = new Set(columns.map((col) => col.key));
      const retainedColumns = Array.from(previousVisibleColumns).filter((columnKey) =>
        nextVisibleColumns.has(columnKey)
      );
      return retainedColumns.length > 0 ? new Set(retainedColumns) : nextVisibleColumns;
    });
  }, [columns]);

  useEffect(() => {
    setSelectedRows((previousSelectedRows) => {
      const currentIds = new Set(
        data
          .map((row, index) => String(row?.id || row?._id || index))
          .filter((rowId): rowId is string => typeof rowId === "string" && rowId.length > 0)
      );

      const nextSelectedRows = new Set(
        Array.from(previousSelectedRows).filter((rowId) => currentIds.has(rowId))
      );

      return nextSelectedRows;
    });
  }, [data]);

  useEffect(() => {
    setSortKey(initialSortKey);
    setSortDirection(initialSortDirection);
  }, [initialSortDirection, initialSortKey]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((previousDirection) =>
        previousDirection === "asc" ? "desc" : "asc"
      );
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  };

  const handleSearch = (data: { searchQuery: string }) =>
    setSearchQuery(data.searchQuery);

  const getColumnComparableValue = (row: any, column: Column): unknown => {
    if (column.sortAccessor) {
      return column.sortAccessor(row);
    }

    const nestedValue = getNestedValue(row, column.key);
    if (nestedValue !== null && nestedValue !== undefined) {
      return nestedValue;
    }

    if (column.render) {
      return extractTextFromReactNode(column.render(row));
    }

    return null;
  };

  const getColumnSearchValue = (row: any, column: Column): unknown => {
    if (column.searchAccessor) {
      return column.searchAccessor(row);
    }

    const nestedValue = getNestedValue(row, column.key);
    if (nestedValue !== null && nestedValue !== undefined) {
      return nestedValue;
    }

    if (column.render) {
      return extractTextFromReactNode(column.render(row));
    }

    return null;
  };

  const rankedAndSortedData = useMemo(() => {
    if (!Array.isArray(data)) {
      return [];
    }

    const normalizedQuery = normalizeString(debouncedSearchQuery);

    const rowsWithScores = data
      .map((row) => {
        const searchableValues = columns.flatMap((column) =>
          collectSearchableText(getColumnSearchValue(row, column))
        );

        searchableValues.push(...collectSearchableText(row?.id));
        searchableValues.push(...collectSearchableText(row?._id));

        const score = normalizedQuery
          ? searchableValues.reduce((maxScore, fieldValue) => {
              const fieldScore = scoreFieldAgainstQuery(fieldValue, normalizedQuery);
              return fieldScore > maxScore ? fieldScore : maxScore;
            }, 0)
          : 0;

        return { row, score };
      })
      .filter((entry) => !normalizedQuery || entry.score > 0);

    rowsWithScores.sort((left, right) => {
      if (sortKey) {
        const sortColumn = columns.find((column) => column.key === sortKey);
        const leftValue = sortColumn
          ? getColumnComparableValue(left.row, sortColumn)
          : getNestedValue(left.row, sortKey);
        const rightValue = sortColumn
          ? getColumnComparableValue(right.row, sortColumn)
          : getNestedValue(right.row, sortKey);
        const compareResult = comparePrimitiveValues(leftValue, rightValue);

        if (compareResult !== 0) {
          return sortDirection === "asc" ? compareResult : -compareResult;
        }
      }

      if (normalizedQuery && right.score !== left.score) {
        return right.score - left.score;
      }

      const leftFallback = String(left.row?.name || left.row?.title || left.row?.id || "");
      const rightFallback = String(
        right.row?.name || right.row?.title || right.row?.id || ""
      );

      return leftFallback.localeCompare(rightFallback, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

    return rowsWithScores.map((entry) => entry.row);
  }, [columns, data, debouncedSearchQuery, sortDirection, sortKey]);

  const handleRefresh = useCallback(() => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    setSearchQuery("");
    setSortKey(initialSortKey);
    setSortDirection(initialSortDirection);
    setSelectedRows(new Set());

    Promise.resolve(onRefresh?.())
      .finally(() => {
        router.refresh();
        setIsRefreshing(false);
      });
  }, [initialSortDirection, initialSortKey, isRefreshing, onRefresh, router]);

  const handleSelectRow = (rowId: string) => {
    setSelectedRows((previousSelectedRows) => {
      const nextSelectedRows = new Set(previousSelectedRows);
      if (nextSelectedRows.has(rowId)) {
        nextSelectedRows.delete(rowId);
      } else {
        nextSelectedRows.add(rowId);
      }
      return nextSelectedRows;
    });
  };

  const handleSelectAll = () => {
    if (selectedRows.size === rankedAndSortedData.length) {
      setSelectedRows(new Set());
    } else {
      const allRowIds = rankedAndSortedData
        .map((row, index) => String(row.id || row._id || index))
        .filter((rowId): rowId is string => typeof rowId === "string" && rowId.length > 0);
      setSelectedRows(new Set(allRowIds));
    }
  };

  const handleToggleColumn = (columnKey: string) => {
    setVisibleColumns((previousVisibleColumns) => {
      const nextVisibleColumns = new Set(previousVisibleColumns);
      if (nextVisibleColumns.has(columnKey)) {
        if (nextVisibleColumns.size > 1) {
          nextVisibleColumns.delete(columnKey);
        }
      } else {
        nextVisibleColumns.add(columnKey);
      }
      return nextVisibleColumns;
    });
  };

  if (!Array.isArray(data)) {
    return (
      <div className="text-center py-12 text-gray-600">{emptyMessage}</div>
    );
  }

  const filteredColumns = columns.filter((col) => visibleColumns.has(col.key));
  const displayedTotalResults =
    debouncedSearchQuery.trim().length > 0
      ? rankedAndSortedData.length
      : totalResults !== undefined
        ? totalResults
        : rankedAndSortedData.length;

  return (
    <div
      className={`w-full bg-white rounded-xl shadow-sm border border-blue-50 overflow-hidden ${className}`}
    >
      {showHeader && (
        <TableHeader
          title={title}
          subtitle={subtitle}
          totalResults={displayedTotalResults}
          currentPage={currentPage}
          resultsPerPage={resultsPerPage}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
      )}
      <TableActions
        data={rankedAndSortedData}
        selectedRows={selectedRows}
        columns={filteredColumns}
        showSearchBar={showSearchBar}
        searchValue={searchQuery}
        onSearch={handleSearch}
        allColumns={columns}
        visibleColumns={visibleColumns}
        onToggleColumn={handleToggleColumn}
      />
      <div className="w-full overflow-x-auto">
        <TableBody
          data={rankedAndSortedData}
          columns={filteredColumns}
          isLoading={isLoading}
          emptyMessage={emptyMessage}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          expandable={expandable}
          expandedRowId={expandedRowId}
          renderExpandedRow={renderExpandedRow}
          selectedRows={selectedRows}
          onSelectRow={handleSelectRow}
          onSelectAll={handleSelectAll}
        />
      </div>
      {showPaginationDetails && totalPages !== undefined && (
        <div className="p-4 border-t border-blue-100">
          <PaginationComponent totalPages={totalPages} />
        </div>
      )}
    </div>
  );
};

export default Table;

