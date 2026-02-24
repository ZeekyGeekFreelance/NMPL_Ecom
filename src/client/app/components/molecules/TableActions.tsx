"use client";

import React from "react";
import { Download } from "lucide-react";
import DropdownMultiSelect from "./DropdownMultiSelect";
import {
  buildCsv,
  downloadCsv,
  formatExportCell,
  getNestedValue,
} from "@/app/utils/export";

interface Column {
  key: string;
  label: string;
  render?: (row: any) => React.ReactNode;
  exportAccessor?: (row: any) => unknown;
}

interface TableActionsProps {
  data: any[];
  selectedRows: Set<string>;
  columns: Column[];
  showSearchBar: boolean;
  searchValue?: string;
  onSearch: (data: { searchQuery: string }) => void;
  allColumns: Column[];
  visibleColumns: Set<string>;
  onToggleColumn: (columnKey: string) => void;
}

const TableActions: React.FC<TableActionsProps> = ({
  data,
  selectedRows,
  columns,
  showSearchBar,
  searchValue = "",
  onSearch,
  allColumns,
  visibleColumns,
  onToggleColumn,
}) => {
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

  const getRowId = (row: any): string | null => {
    const rawId = row?.id ?? row?._id;
    if (typeof rawId === "string" && rawId.trim()) {
      return rawId;
    }
    if (typeof rawId === "number") {
      return String(rawId);
    }
    return null;
  };

  const handleExport = () => {
    const rowsToExport =
      selectedRows.size > 0
        ? data.filter((row) => {
            const rowId = getRowId(row);
            return rowId ? selectedRows.has(rowId) : false;
          })
        : data;

    if (rowsToExport.length === 0) {
      return;
    }

    const headers = columns.map((column) => column.label);

    const rowRecords = rowsToExport.map((row) => {
      const record: Record<string, unknown> = {};

      columns.forEach((column) => {
        const exportValue =
          typeof column.exportAccessor === "function"
            ? column.exportAccessor(row)
            : column.render
              ? extractTextFromReactNode(column.render(row))
              : getNestedValue(row, column.key);

        record[column.label] = formatExportCell(exportValue);
      });

      return record;
    });

    const csvContent = buildCsv(headers, rowRecords);
    downloadCsv(csvContent, `table_export_${new Date().toISOString()}.csv`);
  };

  return (
    <div className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
      <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
        {showSearchBar && (
          <input
            type="text"
            placeholder="Search records by keyword"
            value={searchValue}
            onChange={(e) => onSearch({ searchQuery: e.target.value })}
            className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-auto"
          />
        )}
        <DropdownMultiSelect
          label="Select Columns"
          options={allColumns.map((col) => ({
            label: col.label,
            value: col.key,
          }))}
          selectedValues={Array.from(visibleColumns)}
          onChange={onToggleColumn}
        />
      </div>
      <button
        onClick={handleExport}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 sm:w-auto"
        type="button"
      >
        <span className="flex items-center gap-2">
          <Download size={16} />
          Export {selectedRows.size > 0 ? "Selected" : "All"}
        </span>
      </button>
    </div>
  );
};

export default TableActions;

