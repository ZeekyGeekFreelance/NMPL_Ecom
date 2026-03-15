"use client";

import {
  CheckCircle,
  Clock,
  Copy,
  Package,
  Truck,
  XCircle,
  ShoppingBag,
} from "lucide-react";
import React, { useState } from "react";
import { motion } from "framer-motion";
import getStatusStep from "@/app/utils/getStatusStep";
import formatDate from "@/app/utils/formatDate";
import {
  getCustomerOrderStatusLabel,
  getOrderStatusColor,
  getPaymentStateColor,
  getPaymentStateLabel,
  normalizeOrderStatus,
  resolvePaymentState,
  type OrderLifecycleStatus,
} from "@/app/lib/orderLifecycle";
import useFormatPrice from "@/app/hooks/ui/useFormatPrice";
import { toTitleCaseWords } from "@/app/lib/textNormalization";
import { toPaymentReference } from "@/app/lib/utils/accountReference";

const stepIndexByStatus: Record<OrderLifecycleStatus, number> = {
  PENDING_VERIFICATION: 1,
  WAITLISTED: 2,
  AWAITING_PAYMENT: 2,
  QUOTATION_REJECTED: 3,
  QUOTATION_EXPIRED: 3,
  CONFIRMED: 3,
  DELIVERED: 4,
};

const PayRefChip = ({ payRef }: { payRef: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(payRef).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy payment reference"
      className="mt-1 inline-flex items-center gap-1 rounded border border-emerald-300 bg-white/80 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
    >
      {copied ? "Copied!" : payRef}
      <Copy size={10} className="shrink-0" />
    </button>
  );
};

const OrderStatus = ({ order }) => {
  const formatPrice = useFormatPrice();
  const statusFromTransaction = normalizeOrderStatus(order?.transaction?.status);
  const statusFromOrder = normalizeOrderStatus(order?.status);
  const currentStatus =
    (stepIndexByStatus[statusFromOrder] ?? 0) >=
    (stepIndexByStatus[statusFromTransaction] ?? 0)
      ? statusFromOrder
      : statusFromTransaction;
  const paymentTransactions = Array.isArray(order?.paymentTransactions)
    ? order.paymentTransactions
    : [];
  const confirmedPayments = paymentTransactions.filter(
    (transaction: any) =>
      String(transaction?.status || "").toUpperCase() === "CONFIRMED"
  );
  const paymentState = resolvePaymentState({
    isPayLater: order?.isPayLater,
    paymentDueDate: order?.paymentDueDate,
    paymentTransactions,
    payment: order?.payment,
  });
  const isPaid = paymentState.isPaid;
  const isPayLaterDue =
    !!order?.isPayLater &&
    currentStatus === "DELIVERED" &&
    !!order?.paymentDueDate &&
    !isPaid;
  const hasDueDate = !!order?.paymentDueDate;
  let statusLabel = getCustomerOrderStatusLabel(currentStatus);
  let statusColor = getOrderStatusColor(currentStatus);

  if (order?.isPayLater && (currentStatus === "DELIVERED" || currentStatus === "CONFIRMED")) {
    if (currentStatus === "DELIVERED" && !hasDueDate && !isPaid) {
      statusLabel = "Delivered - Due Date Missing";
      statusColor = "bg-red-100 text-red-800";
    } else {
      statusLabel = `${getCustomerOrderStatusLabel(currentStatus)} - ${getPaymentStateLabel(
        paymentState.state
      )}`;
      statusColor = getPaymentStateColor(paymentState.state);
    }
  }

  const getStatusIcon = (status: OrderLifecycleStatus) => {
    switch (status) {
      case "PENDING_VERIFICATION":
        return <Clock size={18} />;
      case "WAITLISTED":
        return <Package size={18} />;
      case "AWAITING_PAYMENT":
        return <Package size={18} />;
      case "CONFIRMED":
        return <Truck size={18} />;
      case "DELIVERED":
        return <CheckCircle size={18} />;
      case "QUOTATION_REJECTED":
      case "QUOTATION_EXPIRED":
        return <XCircle size={18} />;
      default:
        return <ShoppingBag size={18} />;
    }
  };

  const getStatusDate = (status: OrderLifecycleStatus) => {
    if (status === "PENDING_VERIFICATION") {
      return formatDate(order.createdAt || order.orderDate);
    }

    if (status === "WAITLISTED") {
      if (currentStatus === "WAITLISTED") {
        return formatDate(order.transaction?.updatedAt || order.updatedAt);
      }
      return "Pending";
    }

    if (status === "AWAITING_PAYMENT") {
      if (
        currentStatus !== "PENDING_VERIFICATION" &&
        currentStatus !== "WAITLISTED"
      ) {
        return formatDate(order.transaction?.updatedAt || order.updatedAt);
      }
      return "Pending";
    }

    if (status === "CONFIRMED") {
      if (currentStatus === "CONFIRMED" || currentStatus === "DELIVERED") {
        return formatDate(order.transaction?.updatedAt || order.updatedAt);
      }
      return "Pending";
    }

    if (status === "DELIVERED") {
      if (currentStatus === "DELIVERED") {
        return formatDate(order.transaction?.updatedAt || order.updatedAt);
      }
      return "Pending";
    }

    if (status === "QUOTATION_REJECTED" || status === "QUOTATION_EXPIRED") {
      if (currentStatus === status) {
        return formatDate(order.transaction?.updatedAt || order.updatedAt);
      }
      return "Pending";
    }

    return "N/A";
  };

  const timelineStatuses: OrderLifecycleStatus[] = (() => {
    if (currentStatus === "WAITLISTED") {
      return ["PENDING_VERIFICATION", "WAITLISTED"];
    }

    if (
      currentStatus === "QUOTATION_REJECTED" ||
      currentStatus === "QUOTATION_EXPIRED"
    ) {
      return ["PENDING_VERIFICATION", "AWAITING_PAYMENT", currentStatus];
    }

    return currentStatus === "DELIVERED"
      ? ["PENDING_VERIFICATION", "AWAITING_PAYMENT", "CONFIRMED", "DELIVERED"]
      : ["PENDING_VERIFICATION", "AWAITING_PAYMENT", "CONFIRMED"];
  })();

  const currentStep = getStatusStep(currentStatus);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-xl shadow-md p-6 border border-gray-100"
    >
      <div className="border-b border-gray-100 pb-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <p
            className={`text-sm font-medium px-3 py-1 rounded-full flex items-center gap-1.5 ${statusColor}`}
          >
            {getStatusIcon(currentStatus)}
            <span>{statusLabel}</span>
          </p>
        </div>
      </div>

      {confirmedPayments.length > 0 && (
        <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p className="font-medium">Payment received</p>
          <div className="mt-2 space-y-2">
            {confirmedPayments.map((payment: any) => {
              const payRef = toPaymentReference(payment.id);
              const reference =
                payment?.utrNumber
                  ? `UTR: ${payment.utrNumber}`
                  : payment?.chequeNumber
                  ? `Cheque: ${payment.chequeNumber}`
                  : payment?.gatewayPaymentId
                  ? `Razorpay ID: ${payment.gatewayPaymentId}`
                  : null;
              return (
                <div
                  key={payment.id}
                  className="rounded-md border border-emerald-100 bg-white/70 px-3 py-2"
                >
                  <p className="text-xs text-emerald-700">
                    {payment.paymentReceivedAt
                      ? formatDate(payment.paymentReceivedAt)
                      : "Payment date not recorded"}
                  </p>
                  <p className="text-sm font-semibold text-emerald-900">
                    {formatPrice(Number(payment.amount || 0))} •{" "}
                    {toTitleCaseWords(String(payment.paymentMethod || "Payment"))}
                    {payment.paymentSource
                      ? ` (${toTitleCaseWords(String(payment.paymentSource))})`
                      : ""}
                  </p>
                  <PayRefChip payRef={payRef} />
                  {reference ? (
                    <p className="text-xs text-emerald-700">{reference}</p>
                  ) : null}
                  {payment.notes ? (
                    <p className="text-xs text-emerald-700">{payment.notes}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isPayLaterDue && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Payment due by{" "}
          <span className="font-semibold">
            {formatDate(order.paymentDueDate, { withTime: false })}
          </span>
          . Amount due:{" "}
          <span className="font-semibold">{formatPrice(order.amount)}</span>.
        </div>
      )}

      {(currentStatus === "QUOTATION_REJECTED" ||
        currentStatus === "QUOTATION_EXPIRED") && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          This quotation is no longer active. If you need help, contact support.
        </div>
      )}

      <div className="relative mt-6">
        <div
          className="absolute top-[18px] sm:top-5 left-0 h-0.5 sm:h-1 bg-gray-200 w-full"
          style={{ zIndex: 1 }}
        />
        <div
          className="absolute top-[18px] sm:top-5 left-0 h-0.5 sm:h-1 bg-blue-500 transition-all duration-500"
          style={{
            zIndex: 2,
            width: `${
              ((currentStep - 1) / Math.max(timelineStatuses.length - 1, 1)) *
              100
            }%`,
          }}
        />

        <div className="relative z-10 flex items-start justify-between gap-1 sm:gap-3">
          {timelineStatuses.map((status, index) => {
            const active = stepIndexByStatus[status] <= currentStep;

            return (
              <motion.div
                key={status}
                className="flex-1 min-w-0 flex flex-col items-center text-center"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <div
                  className={`w-9 h-9 sm:w-12 sm:h-12 rounded-md flex items-center justify-center mb-2 ${
                    active
                      ? "bg-blue-100 text-blue-500"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {status === "CONFIRMED" || status === "DELIVERED" ? (
                    <CheckCircle size={18} />
                  ) : (
                    getStatusIcon(status)
                  )}
                </div>
                <span className="text-xs sm:text-sm md:text-base font-medium leading-tight">
                  {getCustomerOrderStatusLabel(status)}
                </span>

                <span className="text-[10px] sm:text-xs md:text-sm text-gray-400 mt-0.5 leading-tight">
                  {getStatusDate(status)}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default OrderStatus;

