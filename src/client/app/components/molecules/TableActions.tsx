"use client";

import React from "react";
import { Download, Loader2 } from "lucide-react";
import DropdownMultiSelect from "./DropdownMultiSelect";
import {
  buildCsv,
  downloadCsv,
  formatExportCell,
  getNestedValue,
} from "@/app/utils/export";
import {
  toAccountReference,
  toAddressReference,
  toOrderReference,
  toPaymentReference,
  toProductReference,
  toShipmentReference,
  toTransactionReference,
} from "@/app/lib/utils/accountReference";

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
  const [isExporting, setIsExporting] = React.useState(false);
  const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  const normalizeRoleForExport = (value: unknown): unknown => {
    if (typeof value !== "string") {
      return value;
    }

    const normalized = value.trim().toUpperCase();
    if (!normalized) {
      return "";
    }

    if (normalized === "CLIENT") {
      return "USER";
    }

    return normalized;
  };

  const mapReferenceForExport = (column: Column, value: unknown): unknown => {
    if (typeof value !== "string") {
      return value;
    }

    const raw = value.trim();
    if (!UUID_PATTERN.test(raw)) {
      return value;
    }

    const normalizedKey = column.key.replace(/\s+/g, "").toLowerCase();
    const normalizedLabel = column.label.replace(/\s+/g, "").toLowerCase();

    if (normalizedKey.includes("orderid") || normalizedLabel.includes("orderid")) {
      return toOrderReference(raw);
    }

    if (
      normalizedKey.includes("paymentid") ||
      normalizedLabel.includes("paymentid")
    ) {
      return toPaymentReference(raw);
    }

    if (
      normalizedKey.includes("transactionid") ||
      normalizedLabel.includes("transactionid")
    ) {
      return toTransactionReference(raw);
    }

    if (
      normalizedKey.includes("userid") ||
      normalizedLabel.includes("userid") ||
      normalizedKey.includes("accountid") ||
      normalizedLabel.includes("accountreference")
    ) {
      return toAccountReference(raw);
    }

    if (
      normalizedKey.includes("productid") ||
      normalizedLabel.includes("productid")
    ) {
      return toProductReference(raw);
    }

    if (
      normalizedKey.includes("shipmentid") ||
      normalizedLabel.includes("shipmentid")
    ) {
      return toShipmentReference(raw);
    }

    if (
      normalizedKey.includes("addressid") ||
      normalizedLabel.includes("addressid")
    ) {
      return toAddressReference(raw);
    }

    if (normalizedKey === "id") {
      if (normalizedLabel.includes("transaction")) {
        return toTransactionReference(raw);
      }
      if (normalizedLabel.includes("order")) {
        return toOrderReference(raw);
      }
      if (normalizedLabel.includes("payment")) {
        return toPaymentReference(raw);
      }
      if (normalizedLabel.includes("user") || normalizedLabel.includes("account")) {
        return toAccountReference(raw);
      }
      if (normalizedLabel.includes("product")) {
        return toProductReference(raw);
      }
      if (normalizedLabel.includes("shipment")) {
        return toShipmentReference(raw);
      }
      if (normalizedLabel.includes("address")) {
        return toAddressReference(raw);
      }
    }

    return value;
  };

  const normalizeExportValue = (column: Column, value: unknown): unknown => {
    const withReference = mapReferenceForExport(column, value);
    const normalizedKey = column.key.replace(/\s+/g, "").toLowerCase();
    const normalizedLabel = column.label.replace(/\s+/g, "").toLowerCase();

    const isRoleField =
      normalizedKey.includes("role") ||
      normalizedLabel.includes("role") ||
      normalizedKey.includes("customertype") ||
      normalizedLabel.includes("customertype");

    if (isRoleField) {
      return normalizeRoleForExport(withReference);
    }

    return withReference;
  };

  const handleExport = () => {
    if (isExporting) {
      return;
    }

    setIsExporting(true);

    try {
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

          record[column.label] = formatExportCell(
            normalizeExportValue(column, exportValue)
          );
        });

        return record;
      });

      const csvContent = buildCsv(headers, rowRecords);
      downloadCsv(csvContent, `table_export_${new Date().toISOString()}.csv`);
    } finally {
      setIsExporting(false);
    }
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
            className="h-11 w-full rounded-lg border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:w-auto"
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
        className="btn-primary w-full sm:w-auto"
        disabled={isExporting}
        type="button"
      >
        <span className="flex items-center gap-2">
          {isExporting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          {isExporting
            ? "Exporting..."
            : `Export ${selectedRows.size > 0 ? "Selected" : "All"}`}
        </span>
      </button>
    </div>
  );
};

export default TableActions;

