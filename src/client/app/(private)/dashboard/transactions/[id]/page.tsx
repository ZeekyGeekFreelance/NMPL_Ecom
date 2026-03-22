"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { Loader2 } from "lucide-react";

/** True when the error is a transient server / infra failure (5xx, network). */
const isTransientServerError = (err: unknown): boolean => {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: unknown };
  const s = Number(e.status);
  return (
    s >= 500 ||
    (e.status as string) === "FETCH_ERROR" ||
    (e.status as string) === "PARSING_ERROR"
  );
};

const TransactionDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [newStatus, setNewStatus] = useState<OrderLifecycleStatus | "">("");
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const [isStatusConfirmModalOpen, setIsStatusConfirmModalOpen] = useState(false);
  const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);
  const [isQuotationConfirmOpen, setIsQuotationConfirmOpen] = useState(false);
  const [hasProcessedQuickAction, setHasProcessedQuickAction] = useState(false);
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

  const { data, isLoading, error, refetch } = useGetTransactionQuery(id, {
    skip: !id || !isAdmin,
    // Always refetch on mount so a fresh navigation never serves stale cache
    refetchOnMountOrArgChange: true,
    pollingInterval: 15000,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const transaction = data?.transaction;
  const order = transaction?.order;

  // Dealer user ID — used to build contextual navigation links
  const dealerId: string | null = order?.user?.id ?? null;

  // Determine whether outstanding balance exists (affects header button label)
  const paymentTransactions = Array.isArray(order?.paymentTransactions)
    ? order.paymentTransactions
    : [];
  const confirmedTxns = paymentTransactions.filter((t: any) => t.status === "CONFIRMED");
  const totalPaid = confirmedTxns.reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
  const amountDue = Math.max(0, Number(order?.amount ?? 0) - totalPaid);
  const isPayLater = !!order?.isPayLater;
  const isSettled = amountDue <= 0;

  /**
   * Context-aware payment navigation:
   *   pay-later + outstanding balance  -> /dashboard/payments  (record / track payment)
   *   pay-later + settled OR no pay-later with known dealer -> /dashboard/dealers?paymentHistory=ID
   *   no dealer (retail order) -> /dashboard/payments
   */
  const paymentContextHref = useMemo(() => {
    if (!transaction) return null;
    if (isPayLater && !isSettled) return "/dashboard/payments";
    if (dealerId) return `/dashboard/dealers?paymentHistory=${dealerId}`;
    return "/dashboard/payments";
  }, [transaction, isPayLater, isSettled, dealerId]);

  const transactionReferenceForDisplay = transaction?.id
    ? toTransactionReference(transaction.id)
    : id.toUpperCase().startsWith("TXN-")
    ? id.toUpperCase()
    : toTransactionReference(id);

  const currentStatus = useMemo(
    () => normalizeOrderStatus(transaction?.status),
    [transaction?.status]
  );

  const availableNextStatuses = useMemo(() => {
    const base = getAllowedNextOrderStatuses(currentStatus);
    if (order?.isPayLater && currentStatus === "AWAITING_PAYMENT") {
      return Array.from(new Set([...base, "DELIVERED"]));
    }
    return base;
  }, [currentStatus, order?.isPayLater]);

  const statusOptions = useMemo(() => {
    if (!availableNextStatuses.length) {
      return [{ label: getOrderStatusLabel(currentStatus), value: currentStatus }];
    }
    return availableNextStatuses.map((status) => {
      const existing = ORDER_STATUS_OPTIONS.find((o) => o.value === status);
      return existing || { label: getOrderStatusLabel(status), value: status };
    });
  }, [availableNextStatuses, currentStatus]);

  const selectedStatus = useMemo(
    () =>
      normalizeOrderStatus(newStatus || availableNextStatuses[0] || transaction?.status),
    [newStatus, availableNextStatuses, transaction?.status]
  );

  const canUpdateStatus =
    availableNextStatuses.length > 0 && availableNextStatuses.includes(selectedStatus);
  const isIrreversibleStatusTransition =
    selectedStatus === "QUOTATION_REJECTED" ||
    selectedStatus === "DELIVERED";
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

  const handleBack = () => router.push("/dashboard/transactions");

  const executeStatusUpdate = async (params: {
    id: string;
    status: OrderLifecycleStatus;
  }) => {
    try {
      await updateTransactionStatus({ id: params.id, status: params.status }).unwrap();
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
    await executeStatusUpdate({ id, status: selectedStatus });
  };

  const handleCancelStatusUpdate = () => setIsStatusConfirmModalOpen(false);

  const handleOpenQuotationModal = useCallback(() => {
    if (!canEditQuotation) return;
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
        if (!row) continue;
        const orderItemId = String(row.orderItemId || "").trim();
        const quantity = Number(row.quantity);
        if (!orderItemId || !Number.isInteger(quantity) || quantity <= 0) continue;
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
              originalQuantityByOrderItemId.get(item.id) || Number(item.quantity) || 1
            )
          ),
        }))
      : [];
    setQuotationRows(rows);
    setIsQuotationModalOpen(true);
  }, [canEditQuotation, order?.orderItems, order?.quotationLogs]);

  useEffect(() => {
    const quickAction = searchParams.get("quickAction");
    if (
      quickAction !== "quote" ||
      hasProcessedQuickAction ||
      isLoading ||
      !transaction
    )
      return;
    setHasProcessedQuickAction(true);
    if (canEditQuotation) {
      handleOpenQuotationModal();
    } else {
      showToast(
        "Quotation editor is unavailable for the current transaction status.",
        "error"
      );
    }
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("quickAction");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }, [
    canEditQuotation,
    handleOpenQuotationModal,
    hasProcessedQuickAction,
    isLoading,
    pathname,
    router,
    searchParams,
    showToast,
    transaction,
  ]);

  const handleCloseQuotationModal = () => {
    setQuotationRows([]);
    setIsQuotationModalOpen(false);
  };

  const handleQuotationQuantityChange = (
    orderItemId: string,
    quantityValue: string
  ) => {
    const parsedQuantity = Number.parseInt(quantityValue, 10);
    setQuotationRows((prev) =>
      prev.map((row) =>
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
    setQuotationRows((prev) =>
      prev.map((row) =>
        row.orderItemId === orderItemId
          ? { ...row, price: Number.isFinite(parsedPrice) ? parsedPrice : 0 }
          : row
      )
    );
  };

  const handleIssueQuotation = async () => {
    if (!id || !canSubmitQuotation || quotationRows.length === 0) return;
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

  const requestIssueQuotation = () => {
    if (!canSubmitQuotation || isIssuingQuotation) return;
    setIsQuotationConfirmOpen(true);
  };

  const handleConfirmIssueQuotation = async () => {
    setIsQuotationConfirmOpen(false);
    await handleIssueQuotation();
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

  // ── Guard: auth loading ───────────────────────────────────────────────────
  if (isAuthLoading) return <CustomLoader />;

  if (!isAdmin) {
    return (
      <ErrorState
        message="You are not authorized to view transaction details."
        onBack={handleBack}
      />
    );
  }

  // ── Guard: query loading ──────────────────────────────────────────────────
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

  // ── Guard: error — distinguish transient server errors from genuine 404s ──
  if (error || !transaction) {
    // Server is cold-starting or temporarily unavailable: show a retrying
    // state instead of "not found".  The 5-second poll will auto-recover.
    if (isTransientServerError(error)) {
      return (
        <div className="p-6">
          <div className="flex flex-col items-center justify-center rounded-lg border border-amber-200 bg-amber-50 p-10 text-center">
            <Loader2
              size={36}
              className="animate-spin text-amber-500 mb-4"
            />
            <p className="text-base font-semibold text-amber-800">
              Connecting to server&hellip;
            </p>
            <p className="mt-1 text-sm text-amber-600">
              The server is initializing. This page will reload automatically.
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-5 rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
            >
              Retry now
            </button>
          </div>
        </div>
      );
    }

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

  // ── Render ────────────────────────────────────────────────────────────────
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
        setNewStatus={(value) => setNewStatus(value as OrderLifecycleStatus | "")}
        statusOptions={statusOptions}
        paymentContextHref={paymentContextHref}
        isPayLater={isPayLater}
        isSettled={isSettled}
      />

      <TransactionOverview transaction={transaction} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <OrderInformation order={order} className="lg:col-span-2" />
        <CustomerInformation
          user={order?.user}
          customerType={order?.customerType}
        />
      </div>

      <PaymentInformation
        payment={order?.payment}
        order={order}
        dealerId={dealerId}
      />

      <ShippingAddress address={order?.address} />

      <TransactionTimeline
        transaction={transaction}
        payment={order?.payment}
        order={order}
      />

      {/* ── Quotation editor modal ─────────────────────────────────────────── */}
      <Modal
        open={isQuotationModalOpen}
        onClose={handleCloseQuotationModal}
        contentClassName="max-w-6xl overflow-hidden p-0"
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 border-b border-gray-200 px-6 pb-4 pt-6">
            <h2 className="pr-12 text-lg font-semibold text-gray-900">
              Edit Quotation
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Update final quantity and unit price for each line item before issuing
              quotation. Quoted quantity cannot exceed original ordered units.
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {quotationRows.some((row) => row.quantity > row.availableStock) && (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                One or more items exceed available stock. Reduce quoted quantity
                to the available units before sending quotation.
              </div>
            )}

            <div className="rounded-md border border-gray-200">
              <table className="w-full table-fixed divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-[20%] px-3 py-2 text-left font-medium text-gray-600">Product</th>
                    <th className="w-[18%] px-3 py-2 text-left font-medium text-gray-600">SKU</th>
                    <th className="w-[10%] px-3 py-2 text-left font-medium text-gray-600">Available</th>
                    <th className="w-[10%] px-3 py-2 text-left font-medium text-gray-600">Original Qty</th>
                    <th className="w-[16%] px-3 py-2 text-left font-medium text-gray-600">Quoted Qty</th>
                    <th className="w-[13%] px-3 py-2 text-left font-medium text-gray-600">Unit Price</th>
                    <th className="w-[13%] px-3 py-2 text-right font-medium text-gray-600">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {quotationRows.map((row) => {
                    const exceedsAvailableStock = row.quantity > row.availableStock;
                    const exceedsOriginalQuantity = row.quantity > row.originalQuantity;
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
                        <td className="break-words px-3 py-2 text-gray-900">{row.productName}</td>
                        <td className="break-all px-3 py-2 font-mono text-xs text-gray-700">{row.sku}</td>
                        <td className={`px-3 py-2 ${exceedsAvailableStock ? "font-semibold text-red-700" : "text-gray-900"}`}>
                          {row.availableStock}
                        </td>
                        <td className="px-3 py-2">{row.originalQuantity}</td>
                        <td className="px-3 py-2 align-top">
                          <input
                            type="number"
                            min={1}
                            max={row.originalQuantity}
                            step={1}
                            value={Number.isFinite(row.quantity) ? row.quantity : ""}
                            onChange={(e) =>
                              handleQuotationQuantityChange(row.orderItemId, e.target.value)
                            }
                            className={`w-full rounded-md border px-2 py-1 ${
                              hasQuantityError
                                ? "border-red-400 bg-red-50 text-red-700"
                                : "border-gray-300"
                            }`}
                          />
                          {exceedsAvailableStock && (
                            <p className="mt-1 text-xs font-medium text-red-700">
                              Exceeds available stock by {row.quantity - row.availableStock} unit(s).
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={Number.isFinite(row.price) ? row.price : ""}
                            onChange={(e) =>
                              handleQuotationPriceChange(row.orderItemId, e.target.value)
                            }
                            className="w-full rounded-md border border-gray-300 px-2 py-1"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-gray-800">
                          {(row.quantity * row.price).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-gray-900">
                Quoted Total:{" "}
                {quotationRows
                  .reduce((sum, row) => sum + row.quantity * row.price, 0)
                  .toFixed(2)}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseQuotationModal}
                  className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={requestIssueQuotation}
                  disabled={!canSubmitQuotation || isIssuingQuotation}
                  className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {isIssuingQuotation ? "Sending..." : "Send Quotation"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={isStatusConfirmModalOpen}
        title="Confirm Status Update"
        type={isIrreversibleStatusTransition ? "danger" : "warning"}
        message={`Are you sure you want to update ${transactionReferenceForDisplay} from ${getOrderStatusLabel(
          currentStatus
        )} to ${getOrderStatusLabel(selectedStatus)}?${
          isIrreversibleStatusTransition ? " This action cannot be undone." : ""
        }`}
        onConfirm={handleConfirmStatusUpdate}
        onCancel={handleCancelStatusUpdate}
        isConfirming={isUpdating}
        disableCancelWhileConfirming
      />

      <ConfirmModal
        isOpen={isQuotationConfirmOpen}
        title="Send Quotation to Customer?"
        type="warning"
        message={`You are about to send a quotation for ${quotationRows.length} item(s). This will update the customer-facing quotation amount and place the order into manual follow-up payment flow.`}
        confirmLabel="Send Quotation"
        onConfirm={handleConfirmIssueQuotation}
        onCancel={() => {
          if (isIssuingQuotation) return;
          setIsQuotationConfirmOpen(false);
        }}
        isConfirming={isIssuingQuotation}
        disableCancelWhileConfirming
      />
    </div>
  );
};

export default withAuth(TransactionDetailsPage);
