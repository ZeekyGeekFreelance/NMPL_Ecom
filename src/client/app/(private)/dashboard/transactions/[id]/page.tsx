"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { withAuth } from "@/app/components/HOC/WithAuth";
import useToast from "@/app/hooks/ui/useToast";
import { useAuth } from "@/app/hooks/useAuth";
import {
  useGetTransactionQuery,
  useIssueQuotationMutation,
  useUpdateTransactionStatusMutation,
} from "@/app/store/apis/TransactionApi";
import PageHeader from "../PageHeader";
import ErrorState from "../ErrorState";
import TransactionOverview from "../TransactionOverview";
import OrderInformation from "../OrderInformation";
import CustomerInformation from "../CustomerInformation";
import PaymentInformation from "../PaymentInformation";
import ShipmentInformation from "../ShipmentInformation";
import ShippingAddress from "../ShippingAddress";
import TransactionTimeline from "../TransactionTimeline";
import { downloadInvoiceByOrderId } from "@/app/lib/utils/downloadInvoice";
import CustomLoader from "@/app/components/feedback/CustomLoader";
import ConfirmModal from "@/app/components/organisms/ConfirmModal";
import Modal from "@/app/components/organisms/Modal";
import {
  ORDER_STATUS_OPTIONS,
  getAllowedNextOrderStatuses,
  getOrderStatusLabel,
  normalizeOrderStatus,
  type OrderLifecycleStatus,
} from "@/app/lib/orderLifecycle";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";
import { toTransactionReference } from "@/app/lib/utils/accountReference";

const TransactionDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [newStatus, setNewStatus] = useState<OrderLifecycleStatus | "">("");
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const [isStatusConfirmModalOpen, setIsStatusConfirmModalOpen] =
    useState(false);
  const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);
  const [quotationRows, setQuotationRows] = useState<
    Array<{
      orderItemId: string;
      productName: string;
      sku: string;
      quantity: number;
      price: number;
      availableStock: number;
      originalQuantity: number;
    }>
  >([]);
  const [updateTransactionStatus, { isLoading: isUpdating }] =
    useUpdateTransactionStatusMutation();
  const [issueQuotation, { isLoading: isIssuingQuotation }] =
    useIssueQuotationMutation();

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPERADMIN";

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useGetTransactionQuery(id, {
    skip: !id || !isAdmin,
    pollingInterval: 8000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const transaction = data?.transaction;
  const order = transaction?.order;
  const transactionReferenceForDisplay = transaction?.id
    ? toTransactionReference(transaction.id)
    : id.toUpperCase().startsWith("TXN-")
    ? id.toUpperCase()
    : toTransactionReference(id);

  const currentStatus = useMemo(
    () => normalizeOrderStatus(transaction?.status),
    [transaction?.status]
  );

  const availableNextStatuses = useMemo(
    () => getAllowedNextOrderStatuses(currentStatus),
    [currentStatus]
  );

  const statusOptions = useMemo(
    () => {
      if (!availableNextStatuses.length) {
        return [
          {
            label: getOrderStatusLabel(currentStatus),
            value: currentStatus,
          },
        ];
      }

      return availableNextStatuses.map((status) => {
        const existingOption = ORDER_STATUS_OPTIONS.find(
          (option) => option.value === status
        );

        return (
          existingOption || {
            label: getOrderStatusLabel(status),
            value: status,
          }
        );
      });
    },
    [availableNextStatuses, currentStatus]
  );

  const selectedStatus = useMemo(
    () =>
      normalizeOrderStatus(
        newStatus || availableNextStatuses[0] || transaction?.status
      ),
    [newStatus, availableNextStatuses, transaction?.status]
  );

  const canUpdateStatus =
    availableNextStatuses.length > 0 &&
    availableNextStatuses.includes(selectedStatus);
  const canEditQuotation =
    currentStatus === "PENDING_VERIFICATION" || currentStatus === "WAITLISTED";

  const canSubmitQuotation =
    quotationRows.length > 0 &&
    quotationRows.every(
      (row) =>
        Number.isInteger(row.quantity) &&
        row.quantity > 0 &&
        row.quantity <= row.originalQuantity &&
        row.quantity <= row.availableStock &&
        Number.isFinite(row.price) &&
        row.price >= 0
    );

  const handleBack = () => {
    router.push("/dashboard/transactions");
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

      showToast("Transaction status updated successfully", "success");
      setNewStatus("");
      refetch();
    } catch (updateError: any) {
      showToast(
        getApiErrorMessage(updateError, "Failed to update transaction status"),
        "error"
      );
    }
  };

  const handleUpdateStatus = async () => {
    if (!id || !selectedStatus || !canUpdateStatus) return;
    setIsStatusConfirmModalOpen(true);
  };

  const handleConfirmStatusUpdate = async () => {
    if (!id || !selectedStatus || !canUpdateStatus) {
      setIsStatusConfirmModalOpen(false);
      return;
    }

    setIsStatusConfirmModalOpen(false);
    await executeStatusUpdate({
      id,
      status: selectedStatus,
    });
  };

  const handleCancelStatusUpdate = () => {
    setIsStatusConfirmModalOpen(false);
  };

  const handleOpenQuotationModal = () => {
    if (!canEditQuotation) {
      return;
    }

    const originalOrderLog = Array.isArray(order?.quotationLogs)
      ? order.quotationLogs.find(
          (log: any) => String(log?.event || "").toUpperCase() === "ORIGINAL_ORDER"
        )
      : null;
    const originalQuantityByOrderItemId = new Map<string, number>();
    if (Array.isArray(originalOrderLog?.lineItems)) {
      for (const entry of originalOrderLog.lineItems) {
        const row =
          entry && typeof entry === "object"
            ? (entry as Record<string, unknown>)
            : null;
        if (!row) {
          continue;
        }

        const orderItemId = String(row.orderItemId || "").trim();
        const quantity = Number(row.quantity);
        if (!orderItemId || !Number.isInteger(quantity) || quantity <= 0) {
          continue;
        }

        originalQuantityByOrderItemId.set(orderItemId, quantity);
      }
    }

    const rows = Array.isArray(order?.orderItems)
      ? order.orderItems.map((item: any) => ({
          orderItemId: item.id,
          productName: item.variant?.product?.name || "Product",
          sku: item.variant?.sku || item.variantId || "N/A",
          quantity: Number(item.quantity) || 1,
          price: Number(item.price) || 0,
          availableStock: Math.max(
            0,
            (Number(item.variant?.stock) || 0) -
              (Number(item.variant?.reservedStock) || 0)
          ),
          originalQuantity: Math.max(
            1,
            Number(
              originalQuantityByOrderItemId.get(item.id) ||
                Number(item.quantity) ||
                1
            )
          ),
        }))
      : [];
    setQuotationRows(rows);
    setIsQuotationModalOpen(true);
  };

  const handleCloseQuotationModal = () => {
    setQuotationRows([]);
    setIsQuotationModalOpen(false);
  };

  const handleQuotationQuantityChange = (
    orderItemId: string,
    quantityValue: string
  ) => {
    const parsedQuantity = Number.parseInt(quantityValue, 10);
    setQuotationRows((prevRows) =>
      prevRows.map((row) =>
        row.orderItemId === orderItemId
          ? {
              ...row,
              quantity: Math.max(
                0,
                Math.min(
                  Number.isFinite(parsedQuantity) ? parsedQuantity : 0,
                  row.originalQuantity
                )
              ),
            }
          : row
      )
    );
  };

  const handleQuotationPriceChange = (
    orderItemId: string,
    priceValue: string
  ) => {
    const parsedPrice = Number.parseFloat(priceValue);
    setQuotationRows((prevRows) =>
      prevRows.map((row) =>
        row.orderItemId === orderItemId
          ? {
              ...row,
              price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
            }
          : row
      )
    );
  };

  const handleIssueQuotation = async () => {
    if (!id || !canSubmitQuotation || quotationRows.length === 0) {
      return;
    }

    try {
      await issueQuotation({
        id,
        quotationItems: quotationRows.map((row) => ({
          orderItemId: row.orderItemId,
          quantity: row.quantity,
          price: Number(row.price.toFixed(2)),
        })),
      }).unwrap();

      setIsQuotationModalOpen(false);
      showToast("Quotation updated and sent to customer", "success");
      refetch();
    } catch (quotationError: unknown) {
      showToast(
        getApiErrorMessage(
          quotationError,
          "Failed to update quotation. Please verify inputs and retry."
        ),
        "error"
      );
    }
  };

  const handleDownloadInvoice = useCallback(async () => {
    if (!order?.id) return;

    setIsDownloadingInvoice(true);
    try {
      await downloadInvoiceByOrderId(order.id);
      showToast("Invoice downloaded successfully", "success");
    } catch (downloadError: unknown) {
      const message =
        downloadError instanceof Error
          ? downloadError.message
          : "Failed to download invoice";
      showToast(message, "error");
    } finally {
      setIsDownloadingInvoice(false);
    }
  }, [order?.id, showToast]);

  if (isAuthLoading) {
    return <CustomLoader />;
  }

  if (!isAdmin) {
    return (
      <ErrorState
        message="You are not authorized to view transaction details."
        onBack={handleBack}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/3" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="h-32 bg-gray-200 rounded w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <ErrorState
        message={
          (error as any)?.data?.message ||
          "The requested transaction could not be found."
        }
        onBack={handleBack}
      />
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        onBack={handleBack}
        onUpdateStatus={handleUpdateStatus}
        onOpenQuotationEditor={handleOpenQuotationModal}
        onDownloadInvoice={handleDownloadInvoice}
        isDownloadingInvoice={isDownloadingInvoice}
        isUpdating={isUpdating}
        isIssuingQuotation={isIssuingQuotation}
        canUpdateStatus={canUpdateStatus}
        canEditQuotation={canEditQuotation}
        newStatus={selectedStatus}
        setNewStatus={setNewStatus}
        statusOptions={statusOptions}
      />

      <TransactionOverview transaction={transaction} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <OrderInformation order={order} className="lg:col-span-2" />
        <CustomerInformation user={order?.user} customerType={order?.customerType} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PaymentInformation payment={order?.payment} />
        <ShipmentInformation shipment={order?.shipment} order={order} />
      </div>

      <ShippingAddress address={order?.address} />

      <TransactionTimeline transaction={transaction} payment={order?.payment} />

      <Modal open={isQuotationModalOpen} onClose={handleCloseQuotationModal}>
        <div className="flex max-h-[82vh] flex-col">
          <h2 className="text-lg font-semibold mb-4 pr-10">
            Edit Quotation and Reserve Stock
          </h2>
          <p className="mb-4 text-sm text-gray-600">
            Update final quantity and unit price for each line item before
            issuing quotation. Quoted quantity cannot exceed original ordered
            units.
          </p>
          <div className="overflow-y-auto pr-1 pb-32">
            {quotationRows.some((row) => row.quantity > row.availableStock) && (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                One or more items exceed available stock. Reduce quoted quantity
                to the available units before sending quotation.
              </div>
            )}
            <div className="overflow-x-auto rounded-md border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">
                      Product
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">
                      SKU
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">
                      Available
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">
                      Original Qty
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">
                      Quoted Qty
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">
                      Unit Price
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">
                      Line Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {quotationRows.map((row) => {
                    const exceedsAvailableStock = row.quantity > row.availableStock;
                    const exceedsOriginalQuantity =
                      row.quantity > row.originalQuantity;
                    const hasQuantityError =
                      exceedsAvailableStock ||
                      exceedsOriginalQuantity ||
                      !Number.isInteger(row.quantity) ||
                      row.quantity <= 0;

                    return (
                      <tr
                        key={row.orderItemId}
                        className={hasQuantityError ? "bg-red-50/40" : undefined}
                      >
                        <td className="px-3 py-2">{row.productName}</td>
                        <td className="px-3 py-2 font-mono">{row.sku}</td>
                        <td
                          className={`px-3 py-2 ${
                            exceedsAvailableStock
                              ? "font-semibold text-red-700"
                              : "text-gray-900"
                          }`}
                        >
                          {row.availableStock}
                        </td>
                        <td className="px-3 py-2">{row.originalQuantity}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={1}
                            max={row.originalQuantity}
                            step={1}
                            value={Number.isFinite(row.quantity) ? row.quantity : ""}
                            onChange={(event) =>
                              handleQuotationQuantityChange(
                                row.orderItemId,
                                event.target.value
                              )
                            }
                            className={`w-24 rounded-md border px-2 py-1 ${
                              hasQuantityError
                                ? "border-red-400 bg-red-50 text-red-700"
                                : "border-gray-300"
                            }`}
                          />
                          {exceedsAvailableStock && (
                            <p className="mt-1 text-xs font-medium text-red-700">
                              Exceeds available stock by{" "}
                              {row.quantity - row.availableStock} unit(s).
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={Number.isFinite(row.price) ? row.price : ""}
                            onChange={(event) =>
                              handleQuotationPriceChange(
                                row.orderItemId,
                                event.target.value
                              )
                            }
                            className="w-28 rounded-md border border-gray-300 px-2 py-1"
                          />
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-800">
                          {(row.quantity * row.price).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-sm font-semibold text-gray-900">
              Quoted Total:{" "}
              {quotationRows
                .reduce((sum, row) => sum + row.quantity * row.price, 0)
                .toFixed(2)}
            </div>
          </div>
          <div className="mt-6 sticky bottom-0 border-t border-gray-200 bg-gradient-to-br from-white to-gray-50 pt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseQuotationModal}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleIssueQuotation}
              disabled={!canSubmitQuotation || isIssuingQuotation}
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {isIssuingQuotation ? "Sending..." : "Send Quotation"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={isStatusConfirmModalOpen}
        title="Confirm Status Update"
        type="warning"
        message={`Are you sure you want to update ${transactionReferenceForDisplay} from ${getOrderStatusLabel(
          currentStatus
        )} to ${getOrderStatusLabel(
          selectedStatus
        )}?`}
        onConfirm={handleConfirmStatusUpdate}
        onCancel={handleCancelStatusUpdate}
      />
    </div>
  );
};

export default withAuth(TransactionDetailsPage);

