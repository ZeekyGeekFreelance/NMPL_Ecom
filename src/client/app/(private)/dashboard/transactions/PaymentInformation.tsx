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
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  CreditCard,
  ExternalLink,
  History,
} from "lucide-react";
import Link from "next/link";

const toTitleCase = (value?: string | null) => {
  if (!value) return "N/A";
  const sanitized = String(value).replace(/[<>"'&]/g, "");
  return sanitized
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const buildPaymentReference = (payment: any) => {
  const sanitize = (s: any) => String(s || "").replace(/[<>"'&]/g, "");
  if (payment?.utrNumber) return `UTR: ${sanitize(payment.utrNumber)}`;
  if (payment?.chequeNumber) return `Cheque: ${sanitize(payment.chequeNumber)}`;
  if (payment?.gatewayPaymentId) {
    const gateway = payment.gatewayName ? `${sanitize(payment.gatewayName)} ` : "";
    return `${gateway}ID: ${sanitize(payment.gatewayPaymentId)}`;
  }
  return null;
};

/**
 * PaymentInformation
 *
 * Props:
 *   payment   – legacy Payment record (may be null/undefined)
 *   order     – full order object (includes paymentTransactions, user, etc.)
 *   dealerId  – the dealer's user ID, used to build the credit-history deep-link
 *
 * PAY-XXXXXXXX navigation logic (production-grade):
 *   Any confirmed PaymentTransaction or legacy Payment record links to
 *   /dashboard/dealers?paymentHistory=DEALER_ID
 *   so the admin lands directly on the dealer's full credit ledger.
 *
 *   This is correct because:
 *   - /dashboard/payments only shows OUTSTANDING (unsettled) orders
 *   - Once a payment is confirmed it is no longer outstanding
 *   - The credit ledger is the canonical audit trail for a dealer's payment history
 */
const PaymentInformation = ({
  payment,
  order,
  dealerId,
}: {
  payment?: any;
  order?: any;
  dealerId?: string | null;
}) => {
  const format = useFormatPrice();

  const paymentTransactions = Array.isArray(order?.paymentTransactions)
    ? order.paymentTransactions
    : [];
  const confirmedTransactions = paymentTransactions.filter(
    (t: any) => t.status === "CONFIRMED"
  );
  const totalPaid = confirmedTransactions.reduce(
    (sum: number, t: any) => sum + Number(t.amount || 0),
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
    paymentTransactions,
    payment,
  });
  const statusLabel = getPaymentStateLabel(paymentState.state);
  const statusColor = getPaymentStateColor(paymentState.state);

  const latestConfirmedPayment = confirmedTransactions
    .slice()
    .sort((a: any, b: any) => {
      const dateA = new Date(a?.paymentReceivedAt || a?.createdAt || 0).getTime();
      const dateB = new Date(b?.paymentReceivedAt || b?.createdAt || 0).getTime();
      return dateB - dateA;
    })[0];

  /**
   * Build the deep-link URL for a PAY-XXXXXXXX reference.
   * Always points to the dealer's payment history so the admin has full context
   * (credit ledger, past orders, balance) rather than the outstanding-only queue.
   */
  const buildDealerHistoryHref = () => {
    if (dealerId) return `/dashboard/dealers?paymentHistory=${dealerId}`;
    return `/dashboard/payments`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 transition-all duration-200 hover:shadow-md">
      <div className="flex items-center mb-4">
        <CreditCard className="mr-2 text-blue-600" size={20} />
        <h2 className="text-base sm:text-lg font-semibold">Payment Information</h2>
      </div>

      {/* ── Pay-later status banner ─────────────────────────────────────── */}
      {isPayLater && (
        <div className="mb-4">
          {isSettled ? (
            <div className="flex items-center gap-2 p-3 rounded-lg border bg-green-50 border-green-200">
              <CheckCircle size={16} className="text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800">Payment settled</p>
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
                isOverdue ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
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
                  className={`text-xs ${isOverdue ? "text-red-600" : "text-amber-600"}`}
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
                  The order is delivered but no due date is set. Update it in Payment
                  Management.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-lg border bg-blue-50 border-blue-200">
              <Clock size={16} className="text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-800">Payment Pending</p>
                <p className="text-xs text-blue-600">
                  Due date will be set once the order is delivered.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Key figures ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 mb-4">
        <div>
          <p className="text-sm text-gray-500">Payment Status</p>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
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
              <p className="font-medium text-red-700">{format(amountDue)}</p>
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

      {/* ── PaymentTransaction records (new model) ─────────────────────── */}
      {confirmedTransactions.length > 0 ? (
        <div className="space-y-3">
          {confirmedTransactions.map((txn: any) => {
            const reference = buildPaymentReference(txn);
            const historyHref = buildDealerHistoryHref();
            return (
              <div
                key={txn.id}
                className="rounded-lg border border-gray-200 bg-gray-50 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {toTitleCase(txn.paymentMethod)}
                      {txn.paymentSource ? ` (${toTitleCase(txn.paymentSource)})` : ""}
                    </p>
                    <p className="text-xs text-gray-500">
                      Received: {formatDate(txn.paymentReceivedAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      {format(txn.amount)}
                    </p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                      <CheckCircle size={12} />
                      CONFIRMED
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600">
                  {/* PAY reference — deep-links to dealer's credit ledger */}
                  <Link
                    href={historyHref}
                    className="inline-flex items-center gap-1 font-mono font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                    title="View dealer payment history & credit ledger"
                  >
                    <History size={11} className="shrink-0" />
                    {toPaymentReference(txn.id)}
                    <ExternalLink size={10} className="shrink-0" />
                  </Link>

                  {reference && <p>{reference}</p>}
                  {txn.bankName && <p>Bank: {txn.bankName}</p>}
                  {txn.transferDate && (
                    <p>Transfer Date: {formatDate(txn.transferDate)}</p>
                  )}
                  {txn.chequeDate && (
                    <p>Cheque Date: {formatDate(txn.chequeDate)}</p>
                  )}
                  {txn.chequeClearingDate && (
                    <p>Cheque Cleared: {formatDate(txn.chequeClearingDate)}</p>
                  )}
                  {txn.recordedBy?.name && (
                    <p>Recorded By: {txn.recordedBy.name}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : payment ? (
        /* ── Legacy Payment record (old model) ─────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6">
          <div>
            <p className="text-sm text-gray-500">Payment Ref</p>
            {/* Legacy Payment.id — link to dealer history if we know the dealer */}
            <Link
              href={buildDealerHistoryHref()}
              className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:underline break-all"
              title="View dealer payment history & credit ledger"
            >
              <History size={11} className="shrink-0" />
              {toPaymentReference(payment.id || "")}
              <ExternalLink size={10} className="shrink-0" />
            </Link>
            <p className="text-xs text-gray-400 mt-0.5">Legacy payment record</p>
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
        <p className="text-sm text-gray-500">
          Payment has not been generated yet.
        </p>
      )}
    </div>
  );
};

export default PaymentInformation;
