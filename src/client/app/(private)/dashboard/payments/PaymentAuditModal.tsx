"use client";

import { useGetPaymentAuditTrailQuery } from "@/app/store/apis/PaymentApi";
import { useGetOrderByIdQuery } from "@/app/store/apis/OrderApi";
import useFormatPrice from "@/app/hooks/ui/useFormatPrice";
import { toOrderReference, toTransactionReference } from "@/app/lib/utils/accountReference";
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
  FileText, 
  Loader2, 
  Shield, 
  User, 
  X 
} from "lucide-react";

interface PaymentAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string | null;
}

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
  const paymentStatusLabel = getPaymentStateLabel(paymentState.state);
  const paymentStatusColor = getPaymentStateColor(paymentState.state);
  const orderStatusLabel = getOrderStatusLabel(order?.status);

  const getActionIcon = (action: string) => {
    if (action.includes("ADMIN_MARKED")) {
      return <CheckCircle size={16} className="text-green-600" />;
    } else if (action.includes("GATEWAY")) {
      return <Activity size={16} className="text-blue-600" />;
    } else if (action.includes("INVOICE")) {
      return <FileText size={16} className="text-purple-600" />;
    } else if (action.includes("BLOCKED")) {
      return <Shield size={16} className="text-red-600" />;
    }
    return <Clock size={16} className="text-gray-600" />;
  };

  const getActionColor = (action: string) => {
    if (action.includes("ADMIN_MARKED")) {
      return "text-green-700 bg-green-50 border-green-200";
    } else if (action.includes("GATEWAY")) {
      return "text-blue-700 bg-blue-50 border-blue-200";
    } else if (action.includes("INVOICE")) {
      return "text-purple-700 bg-purple-50 border-purple-200";
    } else if (action.includes("BLOCKED")) {
      return "text-red-700 bg-red-50 border-red-200";
    }
    return "text-gray-700 bg-gray-50 border-gray-200";
  };

  const formatActionLabel = (action: string) => {
    return action
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
              <p className="text-sm text-gray-600 mt-1">
                Order {orderReference}
                {transactionReference ? ` | ${transactionReference}` : ""}
              </p>
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
              <span className="text-gray-600">Loading audit trail...</span>
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
                  <p className="text-sm font-medium text-gray-900">{order.user.name}</p>
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
                    {auditLogs.map((log, index) => (
                      <div key={log.id} className="relative">
                        {/* Timeline connector */}
                        {index < auditLogs.length - 1 && (
                          <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gray-200" />
                        )}

                        <div className="flex gap-4">
                          {/* Icon */}
                          <div className={`flex-shrink-0 w-12 h-12 rounded-full border-2 flex items-center justify-center ${getActionColor(log.action)}`}>
                            {getActionIcon(log.action)}
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
                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border ${getActionColor(log.action)}`}>
                                  {log.actorRole}
                                </span>
                              </div>

                              {/* Actor */}
                              <div className="flex items-center gap-2 mb-3 text-sm">
                                <User size={14} className="text-gray-400" />
                                <span className="text-gray-700">
                                  {log.actorUser?.name || "System"}
                                </span>
                                {log.actorUser?.email && (
                                  <span className="text-gray-500">({log.actorUser.email})</span>
                                )}
                              </div>

                              {/* Status Change */}
                              {log.previousStatus && log.nextStatus && (
                                <div className="mb-3 text-sm">
                                  <span className="text-gray-600">Status: </span>
                                  <span className="inline-flex items-center gap-2">
                                    <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">
                                      {log.previousStatus}
                                    </span>
                                    <span className="text-gray-400">→</span>
                                    <span className="rounded bg-green-100 px-2 py-0.5 text-green-700">
                                      {log.nextStatus}
                                    </span>
                                  </span>
                                </div>
                              )}

                              {/* Metadata */}
                              {log.metadata && Object.keys(log.metadata).length > 0 && (
                                <div className="mt-3 rounded-lg bg-gray-50 p-3">
                                  <p className="text-xs font-medium text-gray-700 mb-2">Additional Details:</p>
                                  <div className="space-y-1">
                                    {Object.entries(log.metadata).map(([key, value]) => (
                                      <div key={key} className="flex items-start gap-2 text-xs">
                                        <span className="text-gray-600 font-medium min-w-[120px]">
                                          {key.replace(/([A-Z])/g, " $1").trim()}:
                                        </span>
                                        <span className="text-gray-900">
                                          {typeof value === "object" 
                                            ? JSON.stringify(value, null, 2) 
                                            : String(value)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Payment Transaction Details */}
                              {log.paymentTxn && (
                                <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 p-3">
                                  <p className="text-xs font-medium text-blue-900 mb-2">Payment Transaction:</p>
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-blue-700">Method:</span>
                                      <span className="text-blue-900 font-medium">
                                        {log.paymentTxn.paymentMethod}
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
                                        {log.paymentTxn.status}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
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
