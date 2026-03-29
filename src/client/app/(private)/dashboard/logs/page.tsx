"use client";
import Table from "@/app/components/layout/Table";
import {
  useClearLogsMutation,
  useDeleteLogMutation,
  useGetAllLogsQuery,
} from "@/app/store/apis/LogsApi";
import React, { useState } from "react";
import LogContext from "./LogContext";
import { withAuth } from "@/app/components/HOC/WithAuth";
import { toPrefixedReference } from "@/app/lib/utils/accountReference";
import ConfirmModal from "@/app/components/organisms/ConfirmModal";
import LoadingDots from "@/app/components/feedback/LoadingDots";

const LogsDashboard = () => {
  const { data, isLoading, error, refetch } = useGetAllLogsQuery({});
  const [clearLogs, { isLoading: isClearingLogs }] = useClearLogsMutation();
  const [deleteLog, { isLoading: isDeletingLog }] = useDeleteLogMutation();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<
    { type: "delete-log"; logId: string } | { type: "clear-all" } | null
  >(null);
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);

  if (error) {
    console.log("error: ", error);
  }

  // Format the timestamp to be more readable
  const formatTimestamp = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return new Intl.DateTimeFormat("default", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
    } catch (error) {
      console.log("error => ", error);
      return timestamp;
    }
  };

  // Shortens IDs for display
  const shortenId = (id) => {
    if (!id) return "";
    return toPrefixedReference("LOG", id);
  };

  // Handle delete single log
  const handleDeleteLog = (e, logId) => {
    e.stopPropagation(); // Prevent row click
    setConfirmTarget({ type: "delete-log", logId });
    setIsConfirmOpen(true);
  };

  // Handle clear all logs
  const requestClearLogs = () => {
    setConfirmTarget({ type: "clear-all" });
    setIsConfirmOpen(true);
  };

  const closeConfirmation = () => {
    if (isConfirmingAction) {
      return;
    }
    setIsConfirmOpen(false);
    setConfirmTarget(null);
  };

  const handleConfirmAction = async () => {
    if (!confirmTarget) {
      return;
    }

    setIsConfirmingAction(true);

    try {
      if (confirmTarget.type === "delete-log") {
        await deleteLog(confirmTarget.logId).unwrap();
      } else {
        await clearLogs(undefined).unwrap();
      }
      await refetch();
    } finally {
      setIsConfirmingAction(false);
      setIsConfirmOpen(false);
      setConfirmTarget(null);
    }
  };

  const columns = [
    {
      key: "level",
      label: "Level",
      render: (row) => (
        <span
          className={
            row.level === "error"
              ? "text-red-600 bg-red-100 font-medium rounded-full px-2 py-[2px] capitalize"
              : row.level === "warn"
              ? "text-orange-500 bg-orange-100 font-medium rounded-full px-2 py-[2px] capitalize"
              : row.level === "info"
              ? "text-cyan-500 bg-cyan-100 rounded-full px-2 py-[2px] capitalize font-medium"
              : "text-gray-600"
          }
        >
          {row.level}
        </span>
      ),
    },
    {
      key: "message",
      label: "Message",
      className: "max-w-xs truncate",
      render: (row) => (
        <div className="truncate max-w-xs" title={row.message}>
          {row.message}
        </div>
      ),
    },
    {
      key: "context",
      label: "Context",
      render: (row) => (
        <LogContext context={row.context} level={row.level} logId={row.id} />
      ),
    },
    {
      key: "createdAt",
      label: "Timestamp",
      render: (row) => formatTimestamp(row.createdAt),
    },
    {
      key: "id",
      label: "ID",
      className: "text-xs text-gray-500 font-mono",
      render: (row) => shortenId(row.id),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => handleDeleteLog(e, row.id)}
            className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs transition-colors"
            disabled={isDeletingLog}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="type-h3 text-gray-900">System Logs</h1>
        <div className="flex space-x-2">
          <button
            onClick={requestClearLogs}
            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm transition-colors"
            disabled={isClearingLogs || isConfirmingAction}
          >
            Clear All Logs
          </button>
        </div>
      </div>

      {data && data.logs ? (
        <>
          <div className="mb-2 text-sm text-gray-500">
            {data.logs.length} log entries
          </div>
          <Table
            data={data.logs}
            columns={columns}
            isLoading={isLoading}
            showHeader={false}
            className="cursor-pointer hover:bg-gray-50"
          />
        </>
      ) : isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingDots label="Loading" align="center" />
        </div>
      ) : (
        <div className="text-center py-8 text-red-600">Failed to load logs</div>
      )}

      <ConfirmModal
        isOpen={isConfirmOpen}
        title={
          confirmTarget?.type === "clear-all"
            ? "Clear All Logs?"
            : "Delete Log Entry?"
        }
        message={
          confirmTarget?.type === "clear-all"
            ? "You are about to permanently remove all log records. This action cannot be undone."
            : "You are about to permanently remove this log record. This action cannot be undone."
        }
        type="danger"
        confirmLabel={confirmTarget?.type === "clear-all" ? "Clear Logs" : "Delete"}
        onConfirm={handleConfirmAction}
        onCancel={closeConfirmation}
        isConfirming={isConfirmingAction}
        disableCancelWhileConfirming
      />
    </div>
  );
};

export default withAuth(LogsDashboard);
