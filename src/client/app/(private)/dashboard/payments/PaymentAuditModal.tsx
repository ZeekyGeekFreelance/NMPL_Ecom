"use client";

import { useGetPaymentAuditTrailQuery } from "@/app/store/apis/PaymentApi";
import { useGetOrderByIdQuery } from "@/app/store/apis/OrderApi";
import useFormatPrice from "@/app/hooks/ui/useFormatPrice";
import { toOrderReference, toTransactionReference, toPaymentReference } from "@/app/lib/utils/accountReference";
import { 
  getOrderStatusLabel,
  getPaymentStateColor,
  getPaymentStateLabel,
  resolvePaymentState
} from "@/app/lib/orderLifecycle";
import { 
  Activity, 
  Calendar, 
  CheckCircle, 
  Clock, 
  ExternalLink,
  FileText, 
  Loader2, 
  Shield, 
  User, 
  X 
} from "lucide-react";
import Link from "next/link";
import LoadingDots from "@/app/components/feedback/LoadingDots";

interface PaymentAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string | null;
}

type Sanitizable = string | number | boolean | null | undefined;

type AuditActionKind = "ADMIN_MARKED" | "GATEWAY" | "INVOICE" | "BLOCKED" | "OTHER";

/**
 * Sanitize user-controllable strings to prevent XSS attacks.
 * Removes HTML tags, JavaScript protocols, event handlers, and restricts to safe characters.
 */
const sanitizeText = (text: Sanitizable, maxLength = 500): string => {
  if (text === null || text === undefined) return "";

  return String(text)
    .replace(/[<>"'&\/\\]/g, "") // Remove HTML special chars and slashes
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/data:/gi, "") // Remove data: protocol
    .replace(/on\w+=/gi, "") // Remove event handlers like onclick=
    .replace(/[^a-zA-Z0-9_\-\s@.,:()]/g, "") // Only allow safe characters
    .trim()
    .slice(0, maxLength); // Limit length to prevent DoS
};

/**
 * Less restrictive sanitizer for structured data (keeps JSON punctuation readable).
 */
const sanitizeStructuredText = (text: Sanitizable, maxLength = 1000): string => {
  if (text === null || text === undefined) return "";

  return String(text)
    .replace(/javascript:/gi, "")
    .replace(/data:/gi, "")
    .replace(/on\w+=/gi, "")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
};

const sanitizeMetadataValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return sanitizeText(value, 500);
  }

  try {
    return sanitizeStructuredText(JSON.stringify(value, null, 2), 1000);
  } catch {
    return "";
  }
};

const normalizeAuditAction = (action: Sanitizable): AuditActionKind => {
  const normalized = sanitizeText(action, 100).toUpperCase();

  if (normalized.includes("ADMIN_MARKED")) return "ADMIN_MARKED";
  if (normalized.includes("GATEWAY")) return "GATEWAY";
  if (normalized.includes("INVOICE")) return "INVOICE";
  if (normalized.includes("BLOCKED")) return "BLOCKED";
  return "OTHER";
};

const PaymentAuditModal = ({ isOpen, onClose, orderId }: PaymentAuditModalProps) => {
  const formatPrice = useFormatPrice();

  const { data: orderData, isLoading: isLoadingOrder } = useGetOrderByIdQuery(orderId || "", {
    skip: !orderId || !isOpen,
  });

  const { data: auditData, isLoading: isLoadingAudit } = useGetPaymentAuditTrailQuery(orderId || "", {
    skip: !orderId || !isOpen,
  });

  const auditLogs = auditData?.logs || [];
  const order = orderData?.order;
  const orderReference = order?.id ? toOrderReference(order.id) : "";
  const transactionReference = order?.transaction?.id
    ? toTransactionReference(order.transaction.id)
    : "";
  const paymentState = resolvePaymentState({
    isPayLater: order?.isPayLater,
    paymentDueDate: order?.paymentDueDate,
    paymentTransactions: order?.paymentTransactions,
    payment: order?.payment,
  });
  const paymentStatusLabel = sanitizeText(getPaymentStateLabel(paymentState.state), 100);
  const paymentStatusColor = getPaymentStateColor(paymentState.state);
  const orderStatusLabel = sanitizeText(getOrderStatusLabel(order?.status), 100);
  const safeOrderReference = sanitizeText(orderReference, 100);
  const safeTransactionReference = sanitizeText(transactionReference, 100);
  const safeDealerName = sanitizeText(order?.user?.name, 200) || "Unknown";
  const latestPaymentRef = order?.paymentTransactions?.[0]?.id
    ? sanitizeText(toPaymentReference(order.paymentTransactions[0].id), 100)
    : null;

  const getActionIcon = (action: AuditActionKind) => {
    if (action === "ADMIN_MARKED") {
      return <CheckCircle size={16} className="text-green-600" />;
    } else if (action === "GATEWAY") {
      return <Activity size={16} className="text-blue-600" />;
    } else if (action === "INVOICE") {
      return <FileText size={16} className="text-purple-600" />;
    } else if (action === "BLOCKED") {
      return <Shield size={16} className="text-red-600" />;
    }
    return <Clock size={16} className="text-gray-600" />;
  };

  const getActionColor = (action: AuditActionKind) => {
    if (action === "ADMIN_MARKED") {
      return "text-green-700 bg-green-50 border-green-200";
    } else if (action === "GATEWAY") {
      return "text-blue-700 bg-blue-50 border-blue-200";
    } else if (action === "INVOICE") {
      return "text-purple-700 bg-purple-50 border-purple-200";
    } else if (action === "BLOCKED") {
      return "text-red-700 bg-red-50 border-red-200";
    }
    return "text-gray-700 bg-gray-50 border-gray-200";
  };

  const formatActionLabel = (action: string) => {
    // Sanitize and format action label
    const sanitized = sanitizeText(action);
    
    return sanitized
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[calc(100vh-2rem)] w-full max-w-5xl flex-col rounded-xl bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Payment Audit Trail</h2>
            {order && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                <span className="text-sm text-gray-600">Order <span className="font-mono font-medium text-gray-900">{safeOrderReference}</span></span>
                {safeTransactionReference && (
                  <span className="text-sm text-gray-500">TXN <span className="font-mono">{safeTransactionReference}</span></span>
                )}
                {latestPaymentRef && (
                  <Link
                    href={`/dashboard/payments?q=${latestPaymentRef}`}
                    onClick={onClose}
                    className="inline-flex items-center gap-1 rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-xs font-mono font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                    title="View in Payment Management"
                  >
                    {latestPaymentRef}
                    <ExternalLink size={10} className="shrink-0" />
                  </Link>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        {isLoadingOrder || isLoadingAudit ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <Loader2 size={24} className="animate-spin text-gray-400" />
              <LoadingDots label="Loading" />
            </div>
          </div>
        ) : !order ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-600">Order not found</p>
          </div>
        ) : (
          <>
            {/* Order Summary */}
            <div className="border-b border-gray-200 px-6 py-4 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-600">Order Amount</p>
                  <p className="text-lg font-semibold text-gray-900">{formatPrice(order.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Dealer</p>
                  <p className="text-sm font-medium text-gray-900">{safeDealerName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Order Date</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(order.orderDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Payment Status</p>
                  <div className="flex flex-col gap-1">
                    <span
                      className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${paymentStatusColor}`}
                    >
                      {paymentStatusLabel}
                    </span>
                    <p className="text-xs text-gray-500">
                      Order status: {orderStatusLabel}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Audit Logs */}
            <div className="flex-1 overflow-hidden">
              {auditLogs.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Activity size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-600">No audit trail found</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Payment actions will be logged here automatically.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="h-full overflow-y-auto p-6">
                  <div className="space-y-4">
                    {auditLogs.map((log, index) => {
                      const actionKind = normalizeAuditAction(log.action);
                      const safeActorEmail = sanitizeText(log.actorUser?.email);

                      return (
                        <div key={log.id} className="relative">
                        {/* Timeline connector */}
                        {index < auditLogs.length - 1 && (
                          <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gray-200" />
                        )}

                        <div className="flex gap-4">
                          {/* Icon */}
                          <div className={`flex-shrink-0 w-12 h-12 rounded-full border-2 flex items-center justify-center ${getActionColor(actionKind)}`}>
                            {getActionIcon(actionKind)}
                          </div>
                          {/* Content */}
                          <div className="flex-1 pb-8">
                            <div className="rounded-lg border border-gray-200 bg-white p-4">
                              {/* Header */}
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <h3 className="font-medium text-gray-900">
                                    {formatActionLabel(log.action)}
                                  </h3>
                                  <div className="flex items-center gap-3 mt-1">
                                    <div className="flex items-center gap-1 text-xs text-gray-600">
                                      <Calendar size={12} />
                                      {new Date(log.createdAt).toLocaleDateString()}
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-gray-600">
                                      <Clock size={12} />
                                      {new Date(log.createdAt).toLocaleTimeString()}
                                    </div>
                                  </div>
                                </div>
                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border ${getActionColor(actionKind)}`}>
                                  {sanitizeText(log.actorRole)}
                                </span>
                              </div>

                              {/* Actor */}
                              <div className="flex items-center gap-2 mb-3 text-sm">
                                <User size={14} className="text-gray-400" />
                                <span className="text-gray-700">
                                  {sanitizeText(log.actorUser?.name) || "System"}
                                </span>
                                {safeActorEmail && (
                                  <span className="text-gray-500">({safeActorEmail})</span>
                                )}
                              </div>

                              {/* Status Change */}
                              {log.previousStatus && log.nextStatus && (
                                <div className="mb-3 text-sm">
                                  <span className="text-gray-600">Status: </span>
                                  <span className="inline-flex items-center gap-2">
                                    <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">
                                      {sanitizeText(log.previousStatus)}
                                    </span>
                                    <span className="text-gray-400">{"->"}</span>
                                    <span className="rounded bg-green-100 px-2 py-0.5 text-green-700">
                                      {sanitizeText(log.nextStatus)}
                                    </span>
                                  </span>
                                </div>
                              )}

                              {/* Metadata */}
                              {log.metadata && Object.keys(log.metadata).length > 0 && (
                                <div className="mt-3 rounded-lg bg-gray-50 p-3">
                                  <p className="text-xs font-medium text-gray-700 mb-2">Additional Details:</p>
                                  <div className="space-y-1">
                                    {Object.entries(log.metadata).map(([key, value]) => {
                                      const sanitizedKey = sanitizeText(key.replace(/([A-Z])/g, " $1").trim());
                                      const sanitizedValue = sanitizeMetadataValue(value);
                                      
                                      return (
                                        <div key={key} className="flex items-start gap-2 text-xs">
                                          <span className="text-gray-600 font-medium min-w-[120px]">
                                            {sanitizedKey}:
                                          </span>
                                          <span className="text-gray-900 break-all">
                                            {sanitizedValue}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Payment Transaction Details */}
                              {log.paymentTxn && (
                                <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 p-3">
                                  <p className="text-xs font-medium text-blue-900 mb-2">Payment Transaction:</p>
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-blue-700">Payment Ref:</span>
                                      <Link
                                        href={`/dashboard/payments?q=${toPaymentReference(log.paymentTxn.id)}`}
                                        onClick={onClose}
                                        className="inline-flex items-center gap-1 font-mono font-semibold text-indigo-700 hover:underline"
                                        title="View in Payment Management"
                                      >
                                        {toPaymentReference(log.paymentTxn.id)}
                                        <ExternalLink size={10} className="shrink-0" />
                                      </Link>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-blue-700">Method:</span>
                                      <span className="text-blue-900 font-medium">
                                        {sanitizeText(log.paymentTxn.paymentMethod)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-blue-700">Amount:</span>
                                      <span className="text-blue-900 font-medium">
                                        {formatPrice(log.paymentTxn.amount)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-blue-700">Status:</span>
                                      <span className="text-blue-900 font-medium">
                                        {sanitizeText(log.paymentTxn.status)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-500">
              All payment actions are logged for audit and compliance purposes
            </p>
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentAuditModal;
