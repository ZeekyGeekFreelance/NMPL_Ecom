"use client";
import Table from "@/app/components/layout/Table";
import { useState } from "react";
import { Trash2, PenLine, ExternalLink } from "lucide-react";
import ConfirmModal from "@/app/components/organisms/ConfirmModal";
import useToast from "@/app/hooks/ui/useToast";
import { useRouter } from "next/navigation";
import {
  useDeleteTransactionMutation,
  useGetAllTransactionsQuery,
  useUpdateTransactionStatusMutation,
} from "@/app/store/apis/TransactionApi";
import Modal from "@/app/components/organisms/Modal";
import Dropdown from "@/app/components/molecules/Dropdown";
import { withAuth } from "@/app/components/HOC/WithAuth";
import {
  toOrderReference,
  toTransactionReference,
} from "@/app/lib/utils/accountReference";
import {
  ORDER_STATUS_OPTIONS,
  getAllowedNextOrderStatuses,
  getOrderStatusColor,
  getOrderStatusLabel,
  normalizeOrderStatus,
  type OrderLifecycleStatus,
} from "@/app/lib/orderLifecycle";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";
import formatDate from "@/app/utils/formatDate";
import usePageQuery from "@/app/hooks/network/usePageQuery";

const isDevelopment = process.env.NODE_ENV !== "production";
const debugLog = (...args: unknown[]) => {
  if (isDevelopment) {
    console.log(...args);
  }
};

const TransactionsDashboard = () => {
  const { showToast } = useToast();
  const router = useRouter();
  const { page, setPage } = usePageQuery();
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isStatusConfirmModalOpen, setIsStatusConfirmModalOpen] =
    useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<{
    id: string;
    status: OrderLifecycleStatus | "";
  }>({
    id: "",
    status: "",
  });
  const [newStatus, setNewStatus] = useState<OrderLifecycleStatus | "">("");
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{
    id: string;
    currentStatus: OrderLifecycleStatus;
    nextStatus: OrderLifecycleStatus;
  } | null>(null);

  const { data, error, isLoading, refetch } = useGetAllTransactionsQuery(
    { page },
    {
      pollingInterval: 8000,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    }
  );
  const [updateTransactionStatus, { error: updateError }] =
    useUpdateTransactionStatusMutation();
  debugLog("Error updating transaction status:", updateError);
  const [deleteTransaction, { error: deleteError }] =
    useDeleteTransactionMutation();
  debugLog("Error deleting transaction:", deleteError);

  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(
    null
  );

  const handleDeleteTransaction = (id: string) => {
    setIsConfirmModalOpen(true);
    setTransactionToDelete(id);
  };

  const handleUpdateStatus = (transaction: any) => {
    const normalizedStatus = normalizeOrderStatus(transaction.status);
    const nextStatuses = getAllowedNextOrderStatuses(normalizedStatus);

    setSelectedTransaction({
      id: transaction.id,
      status: normalizedStatus,
    });
    setNewStatus(nextStatuses[0] || normalizedStatus);
    setIsStatusModalOpen(true);
  };

  const handleViewDetails = (id: string) => {
    router.push(`/dashboard/transactions/${toTransactionReference(id)}`);
  };

  const canEditQuotation = (status: string) => {
    const normalizedStatus = normalizeOrderStatus(status);
    return (
      normalizedStatus === "PENDING_VERIFICATION" ||
      normalizedStatus === "WAITLISTED"
    );
  };

  const executeStatusUpdate = async (params: {
    id: string;
    status: OrderLifecycleStatus;
  }) => {
    try {
      await updateTransactionStatus({
        id: params.id,
        status: params.status,
      }).unwrap();
      showToast("Status updated successfully", "success");
      refetch();
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, "Failed to update status");
      debugLog("Status update failed:", message, err);
      showToast(message, "error");
    }
  };

  const confirmDelete = async () => {
    if (!transactionToDelete) return;
    setIsConfirmModalOpen(false);
    try {
      await deleteTransaction(transactionToDelete).unwrap();
      setTransactionToDelete(null);
      showToast("Transaction deleted successfully", "success");
    } catch (err) {
      console.error("Failed to delete transaction:", err);
      showToast("Failed to delete transaction", "error");
    }
  };

  const confirmStatusUpdate = async () => {
    if (!selectedTransaction || !newStatus) return;
    setIsStatusModalOpen(false);
    setPendingStatusUpdate({
      id: selectedTransaction.id,
      currentStatus: selectedTransaction.status as OrderLifecycleStatus,
      nextStatus: newStatus,
    });
    setIsStatusConfirmModalOpen(true);
  };

  const confirmStatusUpdateAfterSafetyPrompt = async () => {
    if (!pendingStatusUpdate) {
      setIsStatusConfirmModalOpen(false);
      return;
    }

    setIsStatusConfirmModalOpen(false);
    await executeStatusUpdate({
      id: pendingStatusUpdate.id,
      status: pendingStatusUpdate.nextStatus,
    });
    setPendingStatusUpdate(null);
  };

  const cancelStatusUpdateConfirmation = () => {
    setIsStatusConfirmModalOpen(false);
    setPendingStatusUpdate(null);
  };

  const statusLabelByValue = new Map(
    ORDER_STATUS_OPTIONS.map((option) => [option.value, option.label])
  );

  const availableNextStatuses = selectedTransaction.status
    ? getAllowedNextOrderStatuses(selectedTransaction.status)
    : [];

  const statusOptionsForModal =
    availableNextStatuses.length > 0
      ? availableNextStatuses.map((status) => ({
          value: status,
          label: statusLabelByValue.get(status) || getOrderStatusLabel(status),
        }))
      : selectedTransaction.status
      ? [
          {
            value: selectedTransaction.status,
            label: getOrderStatusLabel(selectedTransaction.status),
          },
        ]
      : [];

  const columns = [
    {
      key: "id",
      label: "Transaction ID",
      sortable: true,
      searchAccessor: (row: any) => toTransactionReference(row.id),
      render: (row: any) => (
        <div className="flex items-center space-x-2">
          <span className="font-mono text-sm">
            {toTransactionReference(row.id)}
          </span>
        </div>
      ),
    },
    {
      key: "orderId",
      label: "Order ID",
      sortable: true,
      searchAccessor: (row: any) => toOrderReference(row.orderId),
      render: (row: any) => (
        <span className="font-mono text-sm">{toOrderReference(row.orderId)}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row: any) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${getOrderStatusColor(
            row.status
          )}`}
        >
          {getOrderStatusLabel(row.status)}
        </span>
      ),
    },
    {
      key: "transactionDate",
      label: "Date",
      sortable: true,
      sortAccessor: (row: any) => {
        const parsedDate = Date.parse(String(row.transactionDate || ""));
        return Number.isNaN(parsedDate) ? 0 : parsedDate;
      },
      render: (row: any) => (
        <span>{formatDate(row.transactionDate)}</span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: any) => (
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => handleViewDetails(row.id)}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-blue-50"
          >
            <ExternalLink size={16} />
            View
          </button>
          <button
            type="button"
            onClick={() => handleUpdateStatus(row)}
            className="text-green-600 hover:text-green-800 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-green-50"
          >
            <PenLine size={16} />
            Update
          </button>
          {canEditQuotation(row.status) ? (
            <button
              type="button"
              onClick={() => handleViewDetails(row.id)}
              className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-indigo-50"
            >
              <PenLine size={16} />
              Quote
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => handleDeleteTransaction(row.id)}
            className="text-red-600 hover:text-red-800 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-red-50"
          >
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      ),
    },
  ];

  const cancelDelete = () => {
    setIsConfirmModalOpen(false);
  };

  const cancelStatusUpdate = () => {
    setIsStatusModalOpen(false);
  };

  const canUpdateStatus =
    !!selectedTransaction?.id &&
    !!newStatus &&
    availableNextStatuses.includes(newStatus as OrderLifecycleStatus);

  const transactions = Array.isArray((data as any)?.transactions)
    ? (data as any).transactions
    : Array.isArray((data as any)?.data?.transactions)
    ? (data as any).data.transactions
    : [];

  const totalPages =
    (data as any)?.totalPages ?? (data as any)?.data?.totalPages;
  const totalResults =
    (data as any)?.totalResults ?? (data as any)?.data?.totalResults;
  const resultsPerPage =
    (data as any)?.resultsPerPage ?? (data as any)?.data?.resultsPerPage;
  const currentPage =
    (data as any)?.currentPage ?? (data as any)?.data?.currentPage;
  const tableEmptyMessage = error
    ? getApiErrorMessage(error, "Failed to load transactions")
    : "No transactions available";

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Transaction List</h1>
        <p className="text-sm text-gray-500">
          Manage and view your transactions
        </p>
      </div>

      <Table
        data={transactions}
        columns={columns}
        isLoading={isLoading}
        emptyMessage={tableEmptyMessage}
        initialSortKey="transactionDate"
        initialSortDirection="desc"
        onRefresh={refetch}
        totalPages={totalPages}
        totalResults={totalResults}
        resultsPerPage={resultsPerPage}
        currentPage={currentPage}
        onPageChange={setPage}
        showHeader={false}
      />

      <ConfirmModal
        isOpen={isConfirmModalOpen}
        message="Are you sure you want to delete this transaction? This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      <ConfirmModal
        isOpen={isStatusConfirmModalOpen}
        title="Confirm Status Update"
        type="warning"
        message={
          pendingStatusUpdate
            ? `Are you sure you want to update ${toTransactionReference(
                pendingStatusUpdate.id
              )} from ${getOrderStatusLabel(
                pendingStatusUpdate.currentStatus
              )} to ${getOrderStatusLabel(pendingStatusUpdate.nextStatus)}?`
            : "Are you sure you want to update this order status?"
        }
        onConfirm={confirmStatusUpdateAfterSafetyPrompt}
        onCancel={cancelStatusUpdateConfirmation}
      />

      {/* Update Status Modal */}
      <Modal open={isStatusModalOpen} onClose={cancelStatusUpdate}>
        <div className="flex max-h-[82vh] flex-col">
          <h2 className="text-lg font-semibold mb-4 pr-10">
            Update Transaction Status
          </h2>
          <div className="space-y-4 overflow-y-auto pr-1 pb-40">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transaction ID
              </label>
              <input
                type="text"
                value={toTransactionReference(selectedTransaction?.id || "")}
                className="w-full p-2 border border-gray-300 rounded-md bg-gray-50"
                disabled
              />
            </div>
            <div className="pb-2 relative z-30">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <Dropdown
                options={statusOptionsForModal}
                value={newStatus}
                onChange={(value) =>
                  setNewStatus((value as OrderLifecycleStatus) || "")
                }
                className="w-full min-h-[42px]"
              />
            </div>
          </div>
          <div className="mt-6 sticky bottom-0 bg-gradient-to-br from-white to-gray-50 border-t border-gray-200 pt-4 flex justify-end space-x-2">
            <button
              onClick={cancelStatusUpdate}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmStatusUpdate}
              disabled={!canUpdateStatus}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              Update Status
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default withAuth(TransactionsDashboard);




