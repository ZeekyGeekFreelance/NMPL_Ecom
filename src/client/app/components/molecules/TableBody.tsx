"use client";

import React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, FileText, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import LoadingDots from "../feedback/LoadingDots";

const getNestedValue = (obj: any, key: string): any => {
  return key
    .split(".")
    .reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), obj);
};

const getTextAlignClass = (align: "left" | "center" | "right" = "left") => {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
};

const getHeaderAlignmentClass = (
  align: "left" | "center" | "right" = "left"
) => {
  if (align === "center") return "justify-center";
  if (align === "right") return "justify-end";
  return "justify-start";
};

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: any) => React.ReactNode;
  sortAccessor?: (row: any) => unknown;
  searchAccessor?: (row: any) => unknown;
  width?: string;
  align?: "left" | "center" | "right";
}

interface TableBodyProps {
  data: any[];
  columns: Column[];
  isLoading: boolean;
  emptyMessage: string;
  sortKey: string | null;
  sortDirection: "asc" | "desc";
  onSort: (key: string) => void;
  expandable: boolean;
  expandedRowId: string | null;
  renderExpandedRow?: (row: any) => React.ReactNode;
  selectedRows: Set<string>;
  onSelectRow: (rowId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

const Checkbox = ({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) => {
  return (
    <button
      type="button"
      className="flex items-center justify-center"
      onClick={onChange}
      aria-pressed={checked}
    >
      <div
        className={`w-5 h-5 flex items-center justify-center border rounded-md transition-all ${
          checked ? "bg-primary border-gray-200" : "border-gray-400"
        }`}
      >
        {checked && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-white w-4 h-4 flex items-center justify-center"
          >
            <Check className="w-4 h-4" />
          </motion.div>
        )}
      </div>
    </button>
  );
};

const TableBody: React.FC<TableBodyProps> = ({
  data,
  columns,
  isLoading,
  emptyMessage,
  sortKey,
  sortDirection,
  onSort,
  expandable,
  expandedRowId,
  renderExpandedRow,
  selectedRows,
  onSelectRow,
  onSelectAll,
  onClearSelection,
}) => {
  const allRowsSelected = selectedRows.size === data.length && data.length > 0;

  const rowVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.05,
        duration: 0.3,
      },
    }),
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
  };

  const expandedRowVariants = {
    hidden: { opacity: 0, height: 0 },
    visible: { opacity: 1, height: "auto", transition: { duration: 0.3 } },
    exit: { opacity: 0, height: 0, transition: { duration: 0.2 } },
  };

  return (
    <div>
      <AnimatePresence>
        {selectedRows.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="border-b-2 border-blue-100 bg-blue-50 px-4 py-3 sm:px-6"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-blue-700">
                {selectedRows.size} {selectedRows.size === 1 ? "row" : "rows"} selected
              </span>
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  className="rounded-md border border-blue-200 bg-white px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={onSelectAll}
                  disabled={allRowsSelected}
                >
                  Select all
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  className="rounded-md border border-blue-200 bg-white px-3 py-1 text-sm text-blue-600 hover:bg-blue-50"
                  onClick={onClearSelection}
                >
                  Clear selection
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <table className="w-full border-collapse min-w-[600px]">
        <thead>
          <tr className="bg-blue-50">
            <th className="px-4 sm:px-6 py-4 text-left">
              <Checkbox
                checked={allRowsSelected}
                onChange={allRowsSelected ? onClearSelection : onSelectAll}
              />
            </th>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`px-4 py-4 text-sm font-medium text-blue-700 sm:px-6 ${getTextAlignClass(
                  column.align
                )}`}
                style={column.width ? { width: column.width } : undefined}
              >
                {column.sortable ? (
                  <motion.button
                    whileTap={{ scale: 0.99 }}
                    type="button"
                    onClick={() => onSort(column.key)}
                    className={`group flex w-full items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
                      sortKey === column.key
                        ? "bg-blue-200/80 text-blue-900"
                        : "bg-blue-100/70 text-blue-700 hover:bg-blue-200/70"
                    } ${getHeaderAlignmentClass(column.align)}`}
                    aria-label={`Sort by ${column.label}`}
                  >
                    <span className="whitespace-nowrap">{column.label}</span>
                    {sortKey === column.key ? (
                      sortDirection === "asc" ? (
                        <ArrowUp size={14} className="text-blue-900" />
                      ) : (
                        <ArrowDown size={14} className="text-blue-900" />
                      )
                    ) : (
                      <ArrowUpDown size={14} className="text-blue-500" />
                    )}
                  </motion.button>
                ) : (
                  <div
                    className={`flex items-center gap-1.5 ${getHeaderAlignmentClass(
                      column.align
                    )}`}
                  >
                    <span className="whitespace-nowrap">{column.label}</span>
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-blue-50">
          {isLoading ? (
            <tr>
              <td colSpan={columns.length + 1} className="text-center py-16">
                <div className="flex justify-center">
                  <LoadingDots label="Loading" align="center" />
                </div>
              </td>
            </tr>
          ) : data.length > 0 ? (
            <AnimatePresence>
              {data.map((row, rowIndex) => {
                const rowId = String(row.id || row._id || rowIndex);
                const isSelected = selectedRows.has(rowId);
                return (
                  <React.Fragment key={rowId || rowIndex}>
                    <motion.tr
                      className={`transition-colors text-sm ${
                        isSelected
                          ? "bg-blue-100/50 hover:bg-blue-100/70"
                          : "hover:bg-blue-50/50"
                      }`}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      custom={rowIndex}
                      variants={rowVariants}
                      layoutId={`row-${rowId}`}
                      transition={{
                        layout: { duration: 0.3 },
                        backgroundColor: { duration: 0.2 },
                      }}
                    >
                      <td className="px-4 sm:px-6 py-4 relative">
                        {isSelected && (
                          <motion.div
                            className="absolute inset-y-0 left-0 w-1 bg-blue-500"
                            initial={{ scaleY: 0 }}
                            animate={{ scaleY: 1 }}
                            transition={{ duration: 0.2 }}
                          />
                        )}
                        <Checkbox
                          checked={isSelected}
                          onChange={() => onSelectRow(rowId)}
                        />
                      </td>
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className={`px-4 py-4 sm:px-6 ${getTextAlignClass(
                            column.align
                          )}`}
                        >
                          {column.render
                            ? column.render(row)
                            : getNestedValue(row, column.key) ?? "-"}
                        </td>
                      ))}
                    </motion.tr>
                    {expandable && (
                      <AnimatePresence>
                        {expandedRowId === rowId && renderExpandedRow && (
                          <motion.tr
                            key={`expanded-row-${rowId}`}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={expandedRowVariants}
                            className={isSelected ? "bg-blue-50/80" : ""}
                          >
                            <td colSpan={columns.length + 1} className="p-0">
                              <div className="overflow-hidden">
                                {renderExpandedRow(row)}
                              </div>
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    )}
                  </React.Fragment>
                );
              })}
            </AnimatePresence>
          ) : (
            <motion.tr
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <td colSpan={columns.length + 1} className="text-center py-16">
                <motion.div
                  className="flex flex-col items-center text-blue-300"
                  initial={{ y: 20 }}
                  animate={{ y: 0 }}
                  transition={{ type: "spring", stiffness: 100 }}
                >
                  <FileText size={32} className="mb-2 opacity-50" />
                  <p>{emptyMessage}</p>
                </motion.div>
              </td>
            </motion.tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TableBody;

