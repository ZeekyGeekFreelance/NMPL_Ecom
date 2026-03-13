"use client";

import useFormatPrice from "@/app/hooks/ui/useFormatPrice";
import { toPaymentReference } from "@/app/lib/utils/accountReference";
import {
  getPaymentStateColor,
  getPaymentStateLabel,
  normalizeOrderStatus,
  resolvePaymentState,
} from "@/app/lib/orderLifecycle";
import formatDate from "@/app/utils/formatDate";
import { AlertTriangle, CheckCircle, Clock, CreditCard } from "lucide-react";

const toTitleCase = (value?: string | null) => {
  if (!value) return "N/A";
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const buildPaymentReference = (payment: any) => {
  if (payment?.utrNumber) return `UTR: ${payment.utrNumber}`;
  if (payment?.chequeNumber) return `Cheque: ${payment.chequeNumber}`;
  if (payment?.gatewayPaymentId) {
    const gateway = payment.gatewayName ? `${payment.gatewayName} ` : "";
    return `${gateway}ID: ${payment.gatewayPaymentId}`;
  }
  return null;
};

const PaymentInformation = ({ payment, order }) => {
  const format = useFormatPrice();
  const paymentTransactions = Array.isArray(order?.paymentTransactions)
    ? order.paymentTransactions
    : [];
  const confirmedTransactions = paymentTransactions.filter(
    (transaction) => transaction.status === "CONFIRMED"
  );
  const totalPaid = confirmedTransactions.reduce(
    (sum, transaction) => sum + Number(transaction.amount || 0),
    0
  );
  const totalAmount = Number(order?.amount ?? payment?.amount ?? 0);
  const amountDue = Math.max(0, totalAmount - totalPaid);
  const invoice = order?.invoice;
  const dueDate = invoice?.paymentDueDate || order?.paymentDueDate;
  const creditTermDays = order?.user?.dealerProfile?.creditTermDays || 30;
  const now = new Date();
  const isPayLater = !!order?.isPayLater;
  const normalizedOrderStatus = normalizeOrderStatus(order?.status);
  const isDelivered = normalizedOrderStatus === "DELIVERED";
  const isSettled = amountDue <= 0;
  const isOverdue =
    !!dueDate && new Date(dueDate).getTime() < now.getTime() && amountDue > 0;
  const daysUntilDue = dueDate
    ? Math.ceil(
        (new Date(dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )
    : null;

  const paymentState = resolvePaymentState({
    isPayLater,
    paymentDueDate: dueDate,
    paymentTransactions: paymentTransactions,
    payment,
  });
  const statusLabel = getPaymentStateLabel(paymentState.state);
  const statusColor = getPaymentStateColor(paymentState.state);
  const latestConfirmedPayment = confirmedTransactions
    .slice()
    .sort((a, b) => {
      const dateA = new Date(a?.paymentReceivedAt || a?.createdAt || 0).getTime();
      const dateB = new Date(b?.paymentReceivedAt || b?.createdAt || 0).getTime();
      return dateB - dateA;
    })[0];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 transition-all duration-200 hover:shadow-md">
      <div className="flex items-center mb-4">
        <CreditCard className="mr-2 text-blue-600" size={20} />
        <h2 className="text-base sm:text-lg font-semibold">Payment Information</h2>
      </div>

      {isPayLater && (
        <div className="mb-4">
          {isSettled ? (
            <div className="flex items-center gap-2 p-3 rounded-lg border bg-green-50 border-green-200">
              <CheckCircle size={16} className="text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  Payment settled
                </p>
                <p className="text-xs text-green-600">
                  {latestConfirmedPayment?.paymentReceivedAt
                    ? `Paid on ${formatDate(latestConfirmedPayment.paymentReceivedAt)}.`
                    : "Outstanding amount cleared."}
                </p>
              </div>
            </div>
          ) : dueDate ? (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg border ${
                isOverdue
                  ? "bg-red-50 border-red-200"
                  : "bg-amber-50 border-amber-200"
              }`}
            >
              {isOverdue ? (
                <AlertTriangle size={16} className="text-red-600" />
              ) : (
                <Clock size={16} className="text-amber-600" />
              )}
              <div>
                <p
                  className={`text-sm font-medium ${
                    isOverdue ? "text-red-800" : "text-amber-800"
                  }`}
                >
                  {isOverdue ? "Payment Overdue" : "Payment Due"}
                </p>
                <p
                  className={`text-xs ${
                    isOverdue ? "text-red-600" : "text-amber-600"
                  }`}
                >
                  Due date: {formatDate(dueDate)}
                  {daysUntilDue !== null &&
                    ` (${Math.abs(daysUntilDue)} days ${
                      isOverdue ? "overdue" : "remaining"
                    })`}
                </p>
              </div>
            </div>
          ) : isDelivered ? (
            <div className="flex items-center gap-2 p-3 rounded-lg border bg-red-50 border-red-200">
              <AlertTriangle size={16} className="text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  Payment due date missing
                </p>
                <p className="text-xs text-red-600">
                  The order is delivered but no due date is set. Update the
                  payment due date in Payment Management.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-lg border bg-blue-50 border-blue-200">
              <Clock size={16} className="text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-800">
                  Payment Pending
                </p>
                <p className="text-xs text-blue-600">
                  Due date will be set once the order is delivered.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 mb-4">
        <div>
          <p className="text-sm text-gray-500">Payment Status</p>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}
          >
            {statusLabel}
          </span>
        </div>
        <div>
          <p className="text-sm text-gray-500">Total Amount</p>
          <p className="font-medium">{format(totalAmount)}</p>
        </div>
        {isPayLater && (
          <>
            <div>
              <p className="text-sm text-gray-500">Outstanding Amount</p>
              <p className="font-medium text-red-700">
                {format(amountDue)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Credit Terms</p>
              <p>{creditTermDays} days</p>
            </div>
          </>
        )}
        {invoice?.invoiceNumber && (
          <div>
            <p className="text-sm text-gray-500">Invoice</p>
            <p className="font-medium">
              {invoice.invoiceNumber} (v{invoice.version || 1})
            </p>
            {invoice.paymentStatus && (
              <p className="text-xs text-gray-500 mt-1">
                Invoice Status: {invoice.paymentStatus}
              </p>
            )}
          </div>
        )}
      </div>

      {confirmedTransactions.length > 0 ? (
        <div className="space-y-3">
          {confirmedTransactions.map((transaction) => {
            const reference = buildPaymentReference(transaction);
            return (
              <div
                key={transaction.id}
                className="rounded-lg border border-gray-200 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {toTitleCase(transaction.paymentMethod)}
                      {transaction.paymentSource
                        ? ` (${toTitleCase(transaction.paymentSource)})`
                        : ""}
                    </p>
                    <p className="text-xs text-gray-500">
                      Received: {formatDate(transaction.paymentReceivedAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      {format(transaction.amount)}
                    </p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                      <CheckCircle size={12} />
                      CONFIRMED
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-600">
                  {reference && <p>{reference}</p>}
                  {transaction.bankName && <p>Bank: {transaction.bankName}</p>}
                  {transaction.transferDate && (
                    <p>Transfer Date: {formatDate(transaction.transferDate)}</p>
                  )}
                  {transaction.chequeDate && (
                    <p>Cheque Date: {formatDate(transaction.chequeDate)}</p>
                  )}
                  {transaction.chequeClearingDate && (
                    <p>
                      Cheque Cleared: {formatDate(transaction.chequeClearingDate)}
                    </p>
                  )}
                  {transaction.recordedBy?.name && (
                    <p>Recorded By: {transaction.recordedBy.name}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : payment ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6">
          <div>
            <p className="text-sm text-gray-500">Payment ID</p>
            <p className="font-mono text-sm break-all">
              {toPaymentReference(payment.id || "")}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Payment Method</p>
            <p className="capitalize">{payment.method}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Amount</p>
            <p className="font-medium">{format(payment.amount)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                payment.status === "PAID"
                  ? "bg-green-100 text-green-800"
                  : payment.status === "PENDING"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {payment.status}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Created At</p>
            <p>{formatDate(payment.createdAt)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Updated At</p>
            <p>{formatDate(payment.updatedAt)}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Payment has not been generated yet.</p>
      )}
    </div>
  );
};

export default PaymentInformation;
