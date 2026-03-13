"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import useFormatPrice from "@/app/hooks/ui/useFormatPrice";
import formatDate from "@/app/utils/formatDate";
import { Calendar, Download, ShoppingBag } from "lucide-react";
import ToggleableText from "@/app/components/atoms/ToggleableText";
import ConfirmModal from "@/app/components/organisms/ConfirmModal";
import useToast from "@/app/hooks/ui/useToast";
import { downloadInvoiceByOrderId } from "@/app/lib/utils/downloadInvoice";
import { toOrderReference } from "@/app/lib/utils/accountReference";
import {
  useAcceptQuotationMutation,
  useRejectQuotationMutation,
} from "@/app/store/apis/OrderApi";
import {
  canDownloadInvoiceForStatus,
  normalizeOrderStatus,
} from "@/app/lib/orderLifecycle";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";
import { usePayLaterPayment } from "@/app/hooks/payment/usePayLaterPayment";
import { useRouter } from "next/navigation";

const quotationEventLabel: Record<string, string> = {
  ORIGINAL_ORDER: "Original Order",
  ADMIN_QUOTATION: "Admin Quotation",
  CUSTOMER_ACCEPTED: "Quotation Accepted",
  CUSTOMER_REJECTED: "Quotation Rejected",
  QUOTATION_EXPIRED: "Quotation Expired",
  PAYMENT_CONFIRMED: "Payment Confirmed",
};

const getAmountContextLabel = (event: string) => {
  if (event === "ORIGINAL_ORDER") {
    return {
      previousLabel: "Actual Order Price",
      updatedLabel: "Actual Order Price",
    };
  }

  if (event === "ADMIN_QUOTATION") {
    return {
      previousLabel: "Previous Quotation",
      updatedLabel: "Updated Quotation",
    };
  }

  if (event === "CUSTOMER_ACCEPTED" || event === "PAYMENT_CONFIRMED") {
    return {
      previousLabel: "Quoted Price",
      updatedLabel: "Accepted At Price",
    };
  }

  return {
    previousLabel: "Previous Price",
    updatedLabel: "Updated Price",
  };
};

const OrderSummary = ({
  order,
  initialQuotationAction,
}: {
  order: any;
  initialQuotationAction?: "pay" | "reject" | null;
}) => {
  const formatPrice = useFormatPrice();
  const { showToast } = useToast();
  const router = useRouter();
  const [acceptQuotation, { isLoading: isAcceptingQuotation }] =
    useAcceptQuotationMutation();
  const [rejectQuotation, { isLoading: isRejectingQuotation }] =
    useRejectQuotationMutation();
  const statusFromTransaction = normalizeOrderStatus(order?.transaction?.status);
  const statusFromOrder = normalizeOrderStatus(order?.status);
  const normalizedOrderStatus =
    statusFromOrder === "DELIVERED"
      ? statusFromOrder
      : statusFromTransaction === "DELIVERED"
      ? statusFromTransaction
      : statusFromTransaction !== "PENDING_VERIFICATION"
      ? statusFromTransaction
      : statusFromOrder;
  const canTakeQuotationDecision = normalizedOrderStatus === "AWAITING_PAYMENT";
  const canDownloadInvoice = canDownloadInvoiceForStatus(normalizedOrderStatus);
  const hasConfirmedPayment =
    Array.isArray(order?.paymentTransactions) &&
    order.paymentTransactions.some(
      (transaction: any) =>
        String(transaction?.status || "").toUpperCase() === "CONFIRMED"
    );
  const isPaid =
    hasConfirmedPayment || String(order?.payment?.status || "").toUpperCase() === "PAID";
  const isPayLaterDue =
    !!order?.isPayLater &&
    normalizedOrderStatus === "DELIVERED" &&
    !!order?.paymentDueDate &&
    !isPaid;
  const actionTriggeredRef = useRef(false);
  const [pendingQuotationAction, setPendingQuotationAction] = useState<
    "pay" | "reject" | null
  >(null);
  const [isQuotationConfirmOpen, setIsQuotationConfirmOpen] = useState(false);
  const [isPayDueConfirmOpen, setIsPayDueConfirmOpen] = useState(false);
  const quotationLogs = Array.isArray(order?.quotationLogs)
    ? order.quotationLogs
    : [];
  const subtotal = useMemo(() => Number(order?.subtotalAmount ?? order?.amount ?? 0), [
    order?.subtotalAmount,
    order?.amount,
  ]);
  const deliveryCharge = useMemo(() => {
    if (typeof order?.deliveryCharge === "number") {
      return order.deliveryCharge;
    }
    if (typeof order?.address?.deliveryCharge === "number") {
      return order.address.deliveryCharge;
    }
    return 0;
  }, [order?.address?.deliveryCharge, order?.deliveryCharge]);
  const finalTotal = useMemo(() => {
    if (typeof order?.amount === "number") {
      return order.amount;
    }
    return Number((subtotal + deliveryCharge).toFixed(2));
  }, [order?.amount, subtotal, deliveryCharge]);
  const total = useMemo(() => {
    return formatPrice(finalTotal);
  }, [finalTotal, formatPrice]);
  const payLaterPayment = usePayLaterPayment(order, {
    onSuccess: () => {
      router.refresh();
    },
  });

  const handleDownloadInvoice = useCallback(async () => {
    if (!canDownloadInvoice) {
      if (
        normalizedOrderStatus === "QUOTATION_REJECTED" ||
        normalizedOrderStatus === "QUOTATION_EXPIRED"
      ) {
        showToast(
          "This quotation is no longer active, so invoice download is unavailable.",
          "info"
        );
        return;
      }
      showToast(
        "Invoice is generated only after payment confirmation.",
        "info"
      );
      return;
    }

    try {
      await downloadInvoiceByOrderId(order.id);
      showToast("Invoice downloaded successfully", "success");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to download invoice";
      showToast(message, "error");
    }
  }, [canDownloadInvoice, normalizedOrderStatus, order.id, showToast]);

  const handleProceedToPayment = useCallback(async () => {
    try {
      const response = await acceptQuotation(order.id).unwrap();
      const checkoutUrl =
        response?.checkoutUrl ||
        response?.data?.checkoutUrl ||
        response?.data?.data?.checkoutUrl;
      const isPayLater =
        response?.isPayLater ||
        response?.data?.isPayLater ||
        response?.data?.data?.isPayLater;

      if (!checkoutUrl && isPayLater) {
        showToast(
          "Order confirmed under pay-later terms. Payment will be due after delivery.",
          "success"
        );
        return;
      }

      if (!checkoutUrl) {
        showToast(
          "Payment link is unavailable. Please refresh and try again.",
          "error"
        );
        return;
      }

      window.location.assign(checkoutUrl);
    } catch (error: unknown) {
      showToast(
        getApiErrorMessage(
          error,
          "Unable to start payment for this quotation."
        ),
        "error"
      );
    }
  }, [acceptQuotation, order.id, showToast]);

  const handleRejectQuotation = useCallback(async () => {
    try {
      await rejectQuotation(order.id).unwrap();
      showToast("Quotation cancelled successfully.", "success");
    } catch (error: unknown) {
      showToast(
        getApiErrorMessage(error, "Unable to cancel quotation right now."),
        "error"
      );
    }
  }, [order.id, rejectQuotation, showToast]);

  const requestProceedToPayment = useCallback(() => {
    if (!canTakeQuotationDecision || isAcceptingQuotation || isRejectingQuotation) {
      return;
    }
    setPendingQuotationAction("pay");
    setIsQuotationConfirmOpen(true);
  }, [canTakeQuotationDecision, isAcceptingQuotation, isRejectingQuotation]);

  const requestRejectQuotation = useCallback(() => {
    if (!canTakeQuotationDecision || isAcceptingQuotation || isRejectingQuotation) {
      return;
    }
    setPendingQuotationAction("reject");
    setIsQuotationConfirmOpen(true);
  }, [canTakeQuotationDecision, isAcceptingQuotation, isRejectingQuotation]);

  const handleConfirmQuotationAction = useCallback(async () => {
    if (!pendingQuotationAction) {
      setIsQuotationConfirmOpen(false);
      return;
    }

    setIsQuotationConfirmOpen(false);

    if (pendingQuotationAction === "pay") {
      await handleProceedToPayment();
    } else {
      await handleRejectQuotation();
    }

    setPendingQuotationAction(null);
  }, [handleProceedToPayment, handleRejectQuotation, pendingQuotationAction]);

  useEffect(() => {
    if (actionTriggeredRef.current) {
      return;
    }

    if (!canTakeQuotationDecision) {
      return;
    }

    if (initialQuotationAction === "pay") {
      actionTriggeredRef.current = true;
      setPendingQuotationAction("pay");
      setIsQuotationConfirmOpen(true);
      return;
    }

    if (initialQuotationAction === "reject") {
      actionTriggeredRef.current = true;
      setPendingQuotationAction("reject");
      setIsQuotationConfirmOpen(true);
    }
  }, [
    canTakeQuotationDecision,
    initialQuotationAction,
  ]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="bg-white rounded-xl shadow-md p-6 border border-gray-100"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base sm:text-lg font-bold text-gray-800">Order Details</h2>
        <button
          type="button"
          onClick={handleDownloadInvoice}
          disabled={!canDownloadInvoice}
          className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={15} />
          Invoice PDF
        </button>
      </div>
      {!canDownloadInvoice && (
        <p
          className={`mb-4 text-xs ${
            normalizedOrderStatus === "QUOTATION_REJECTED" ||
            normalizedOrderStatus === "QUOTATION_EXPIRED"
              ? "text-red-700"
              : "text-amber-700"
          }`}
        >
          {normalizedOrderStatus === "QUOTATION_REJECTED" ||
          normalizedOrderStatus === "QUOTATION_EXPIRED"
            ? "This quotation is closed. Invoice is not available."
            : "Invoice is generated only after payment confirmation."}
        </p>
      )}

      {isPayLaterDue && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-medium">Payment due after delivery</p>
          <p className="mt-1 text-xs">
            Due by {formatDate(order.paymentDueDate, { withTime: false })}. Amount
            due: {formatPrice(order.amount)}.
          </p>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setIsPayDueConfirmOpen(true)}
              disabled={payLaterPayment.isLoading}
              className="rounded-md bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300"
            >
              {payLaterPayment.isLoading ? "Redirecting..." : "Pay Due Amount"}
            </button>
          </div>
        </div>
      )}

      {canTakeQuotationDecision && (
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm font-medium text-blue-900">
            Quotation approved. Complete payment to confirm your order.
          </p>
          <p className="mt-1 text-xs text-blue-800">
            Reservation expires at{" "}
            {order?.reservation?.expiresAt || order?.reservationExpiresAt
              ? formatDate(
                  order?.reservation?.expiresAt || order?.reservationExpiresAt
                )
              : "N/A"}
            .
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={requestProceedToPayment}
              disabled={isAcceptingQuotation || isRejectingQuotation}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {isAcceptingQuotation ? "Redirecting..." : "Proceed to Payment"}
            </button>
            <button
              type="button"
              onClick={requestRejectQuotation}
              disabled={isAcceptingQuotation || isRejectingQuotation}
              className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRejectingQuotation ? "Cancelling..." : "Cancel Quotation"}
            </button>
          </div>
        </div>
      )}

      <div className="mb-4">
        <h3 className="mb-2 text-sm sm:text-base font-semibold text-gray-800">
          Quotation History
        </h3>
        {quotationLogs.length === 0 ? (
          <p className="text-xs text-gray-500">
            No quotation revisions recorded yet.
          </p>
        ) : (
          <div className="space-y-2">
            {quotationLogs.map((log: any) => {
              const amountLabels = getAmountContextLabel(String(log.event || ""));
              const showPreviousAmount =
                String(log.event || "") !== "ORIGINAL_ORDER" &&
                log.previousTotal !== null &&
                log.previousTotal !== undefined;
              return (
                <div
                  key={log.id}
                  className="rounded-md border border-gray-200 bg-gray-50 p-3"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs font-semibold text-gray-800">
                      {quotationEventLabel[String(log.event || "")] ||
                        String(log.event || "Quotation Update")}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(log.createdAt)}
                    </p>
                  </div>
                  <div
                    className={`mt-1 grid grid-cols-1 gap-1 text-xs ${
                      showPreviousAmount ? "sm:grid-cols-2" : "sm:grid-cols-1"
                    }`}
                  >
                    {showPreviousAmount ? (
                      <p>
                        <span className="text-gray-500">
                          {amountLabels.previousLabel}:
                        </span>{" "}
                        <span className="font-medium text-gray-800">
                          {formatPrice(Number(log.previousTotal))}
                        </span>
                      </p>
                    ) : null}
                    <p>
                      <span className="text-gray-500">
                        {amountLabels.updatedLabel}:
                      </span>{" "}
                      <span className="font-semibold text-gray-900">
                        {formatPrice(Number(log.updatedTotal || 0))}
                      </span>
                    </p>
                  </div>
                  {log.message ? (
                    <p className="mt-1 text-xs text-gray-600">{log.message}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Order Details Section */}
      <div className="border-b border-gray-100 pb-4 mb-4">
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <ShoppingBag size={14} className="shrink-0 text-gray-400" />
            <span className="text-gray-500">Order ID:</span>
            <span className="font-medium text-gray-800">
              <ToggleableText
                content={toOrderReference(order?.id || "")}
                truncateLength={12}
              />
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar size={14} className="shrink-0 text-gray-400" />
            <span>Placed on {formatDate(order.orderDate)}</span>
          </div>
        </div>
      </div>

      {/* Financial Summary Section */}
      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Product Price</span>
          <div className="flex items-center gap-3">
            <span className="text-gray-400">{order.orderItems.length} item(s)</span>
            <span className="font-medium text-gray-800">{formatPrice(subtotal)}</span>
          </div>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Delivery Charge</span>
          <span className="font-medium text-gray-800">{formatPrice(deliveryCharge)}</span>
        </div>
        <div className="flex justify-between pt-2 border-t border-gray-100 text-gray-800">
          <span className="font-semibold">Total</span>
          <span className="font-semibold">{total}</span>
        </div>
      </div>

      <ConfirmModal
        isOpen={isQuotationConfirmOpen}
        title={
          pendingQuotationAction === "pay"
            ? "Proceed to Payment?"
            : "Cancel Quotation?"
        }
        message={
          pendingQuotationAction === "pay"
            ? `You are proceeding with payment for this quotation at ${total}. You will be redirected to the payment gateway.`
            : "You are about to cancel this quotation. This action cannot be undone."
        }
        type={pendingQuotationAction === "pay" ? "warning" : "danger"}
        confirmLabel={
          pendingQuotationAction === "pay" ? "Proceed to Payment" : "Cancel Quotation"
        }
        onConfirm={handleConfirmQuotationAction}
        onCancel={() => {
          setIsQuotationConfirmOpen(false);
          setPendingQuotationAction(null);
        }}
        isConfirming={isAcceptingQuotation || isRejectingQuotation}
        disableCancelWhileConfirming
      />

      <ConfirmModal
        isOpen={isPayDueConfirmOpen}
        title="Pay Due Amount?"
        message={`You are about to settle the due amount of ${total}. You will be redirected to the payment gateway.`}
        type="warning"
        confirmLabel="Pay Due Amount"
        onConfirm={async () => {
          setIsPayDueConfirmOpen(false);
          await payLaterPayment.startPayment();
        }}
        onCancel={() => setIsPayDueConfirmOpen(false)}
        isConfirming={payLaterPayment.isLoading}
        disableCancelWhileConfirming
      />
    </motion.div>
  );
};

export default OrderSummary;
