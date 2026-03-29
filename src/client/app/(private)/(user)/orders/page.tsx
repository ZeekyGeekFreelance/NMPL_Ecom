"use client";

import React from "react";
import { useGetUserOrdersQuery } from "@/app/store/apis/OrderApi";
import MainLayout from "@/app/components/templates/MainLayout";
import { motion } from "framer-motion";
import {
  Package,
  Calendar,
  DollarSign,
  ShoppingBag,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  ArrowRight,
  FileText,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { withAuth } from "@/app/components/HOC/WithAuth";
import OrderCardSkeleton from "@/app/components/feedback/OrderCardSkeleton";
import OrderFilters from "@/app/components/molecules/OrderFilters";
import ConfirmModal from "@/app/components/organisms/ConfirmModal";
import useToast from "@/app/hooks/ui/useToast";
import { downloadInvoiceByOrderId } from "@/app/lib/utils/downloadInvoice";
import {
  canDownloadInvoiceForOrder,
  getCustomerOrderStatusLabel,
  getPaymentStateColor,
  getPaymentStateLabel,
  normalizeOrderStatus,
  resolvePaymentState,
} from "@/app/lib/orderLifecycle";
import { toOrderReference } from "@/app/lib/utils/accountReference";
import formatDate from "@/app/utils/formatDate";
import useFormatPrice from "@/app/hooks/ui/useFormatPrice";
import { useAcceptQuotationMutation } from "@/app/store/apis/OrderApi";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";
import { usePayLaterPayment } from "@/app/hooks/payment/usePayLaterPayment";
import MiniSpinner from "@/app/components/feedback/MiniSpinner";

// Status badge component
const StatusBadge = ({
  order,
}: {
  order: any;
}) => {
  const normalizedStatus = normalizeOrderStatus(order?.status);
  const paymentState = resolvePaymentState({
    isPayLater: order?.isPayLater,
    paymentDueDate: order?.paymentDueDate,
    paymentTransactions: order?.paymentTransactions,
    payment: order?.payment,
  });
  const hasDueDate = !!order?.paymentDueDate;
  let statusLabel = getCustomerOrderStatusLabel(normalizedStatus);
  let color = "bg-amber-100 text-amber-800";
  let IconComponent: React.ElementType = Clock;

  const configs = {
    PENDING_VERIFICATION: {
      color: "bg-amber-100 text-amber-800",
      icon: Clock,
    },
    WAITLISTED: { color: "bg-orange-100 text-orange-800", icon: Clock },
    AWAITING_PAYMENT: { color: "bg-blue-100 text-blue-800", icon: Truck },
    QUOTATION_REJECTED: { color: "bg-red-100 text-red-800", icon: XCircle },
    QUOTATION_EXPIRED: { color: "bg-red-100 text-red-800", icon: XCircle },
    CONFIRMED: { color: "bg-green-100 text-green-800", icon: CheckCircle },
    DELIVERED: { color: "bg-emerald-100 text-emerald-800", icon: CheckCircle },
  };

  const baseConfig =
    configs[normalizedStatus as keyof typeof configs] ||
    configs.PENDING_VERIFICATION;
  color = baseConfig.color;
  IconComponent = baseConfig.icon;

  if (order?.isPayLater && (normalizedStatus === "DELIVERED" || normalizedStatus === "CONFIRMED")) {
    if (normalizedStatus === "DELIVERED" && !hasDueDate && !paymentState.isPaid) {
      statusLabel = "Delivered - Due Date Missing";
      color = "bg-red-100 text-red-800";
      IconComponent = AlertTriangle;
    } else {
      statusLabel = `${getCustomerOrderStatusLabel(normalizedStatus)} - ${getPaymentStateLabel(
        paymentState.state
      )}`;
      color = getPaymentStateColor(paymentState.state);
      IconComponent = paymentState.state === "PAID" ? CheckCircle : Clock;
    }
  }

  return (
    <div
      className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${color}`}
    >
      <IconComponent size={12} className="sm:w-3 sm:h-3 mr-1" />
      <span className="hidden sm:inline">{statusLabel}</span>
      <span className="sm:hidden">
        {statusLabel.split(" ")[0]}
      </span>
    </div>
  );
};

// Order card component
const OrderCard = ({
  order,
  onDownloadInvoice,
}: {
  order: any;
  onDownloadInvoice: (orderId: string) => void;
}) => {
  const formatPrice = useFormatPrice();
  const { showToast } = useToast();
  const [acceptQuotation, { isLoading: isAcceptingQuotation }] =
    useAcceptQuotationMutation();
  const [isProceedConfirmOpen, setIsProceedConfirmOpen] = React.useState(false);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = React.useState(false);

  const getItemCount = (orderItems: any[]) => {
    return (
      orderItems?.reduce(
        (total: number, item: any) => total + item.quantity,
        0
      ) || 0
    );
  };

  const orderReference = toOrderReference(order.id);
  const normalizedStatus = normalizeOrderStatus(order.status);
  const paymentState = resolvePaymentState({
    isPayLater: order?.isPayLater,
    paymentDueDate: order?.paymentDueDate,
    paymentTransactions: order?.paymentTransactions,
    payment: order?.payment,
  });
  const canProceedToPayment = normalizedStatus === "AWAITING_PAYMENT";
  const isPayLaterDue =
    order?.isPayLater &&
    normalizedStatus === "DELIVERED" &&
    !!order?.paymentDueDate &&
    !paymentState.isPaid;
  const canDownloadInvoice = canDownloadInvoiceForOrder({
    status: order?.status,
    transactionStatus: order?.transaction?.status,
    isPayLater: order?.isPayLater,
    paymentDueDate: order?.paymentDueDate,
    paymentTransactions: order?.paymentTransactions,
    payment: order?.payment,
  });
  const payLaterPayment = usePayLaterPayment(order);

  const handleProceedToPayment = React.useCallback(async () => {
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

  const requestProceedToPayment = React.useCallback(() => {
    if (isAcceptingQuotation || payLaterPayment.isLoading) {
      return;
    }
    setIsProceedConfirmOpen(true);
  }, [isAcceptingQuotation, payLaterPayment.isLoading]);

  const handleConfirmProceedToPayment = React.useCallback(async () => {
    setIsProceedConfirmOpen(false);
    await handleProceedToPayment();
  }, [handleProceedToPayment]);

  const handleConfirmPayDue = React.useCallback(async () => {
    setIsProceedConfirmOpen(false);
    await payLaterPayment.startPayment();
  }, [payLaterPayment]);

  const handleDownloadInvoice = React.useCallback(async () => {
    if (isDownloadingInvoice) {
      return;
    }

    setIsDownloadingInvoice(true);
    try {
      await onDownloadInvoice(order.id);
    } finally {
      setIsDownloadingInvoice(false);
    }
  }, [isDownloadingInvoice, onDownloadInvoice, order.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 overflow-hidden"
    >
      {/* Header */}
      <div className="p-3 sm:p-4 lg:p-6 border-b border-gray-100">
        <div className="flex items-start justify-between mb-2 sm:mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1 sm:space-x-2 mb-1 sm:mb-2">
              <Package
                size={14}
                className="sm:w-4 sm:h-4 text-gray-500 flex-shrink-0"
              />
              <span className="text-xs sm:text-sm text-gray-600 font-medium truncate">
                Order #{orderReference}
              </span>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2">
              <Calendar
                size={12}
                className="sm:w-3 sm:h-3 text-gray-400 flex-shrink-0"
              />
              <span className="text-xs sm:text-sm text-gray-500 truncate">
                {formatDate(order.orderDate)}
              </span>
            </div>
          </div>
          <StatusBadge order={order} />
        </div>
      </div>

      {/* Content */}
      <div className="p-3 sm:p-4 lg:p-6">
        <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-3 sm:mb-4">
          <div className="flex items-center space-x-1 sm:space-x-2">
            <DollarSign
              size={14}
              className="sm:w-4 sm:h-4 text-green-500 flex-shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Total Amount</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900 truncate">
                {formatPrice(order.amount)}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2">
            <ShoppingBag
              size={14}
              className="sm:w-4 sm:h-4 text-blue-500 flex-shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Items</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">
                {getItemCount(order.orderItems)}
              </p>
            </div>
          </div>
        </div>

        {isPayLaterDue && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Payment due by {formatDate(order.paymentDueDate, { withTime: false })}
            . Amount due: {formatPrice(order.amount)}.
          </div>
        )}

        {/* Order Items Preview */}
        {order.orderItems && order.orderItems.length > 0 && (
          <div className="mb-3 sm:mb-4">
            <p className="text-xs text-gray-500 mb-1 sm:mb-2">Items:</p>
            <div className="space-y-1">
              {order.orderItems.slice(0, 2).map((item: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between text-xs sm:text-sm"
                >
                  {item.variant?.product?.slug ? (
                    <Link
                      href={`/product/${item.variant.product.slug}`}
                      className="text-gray-700 hover:text-indigo-600 truncate flex-1 mr-2 transition-colors"
                    >
                      {item.variant?.product?.name || "Product"}
                      {item.quantity > 1 && ` (x${item.quantity})`}
                    </Link>
                  ) : (
                    <span className="text-gray-700 truncate flex-1 mr-2">
                      {item.variant?.product?.name || "Product"}
                      {item.quantity > 1 && ` (x${item.quantity})`}
                    </span>
                  )}
                  <span className="text-gray-500 font-medium text-xs sm:text-sm flex-shrink-0">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>
              ))}
              {order.orderItems.length > 2 && (
                <p className="text-xs text-gray-400">
                  +{order.orderItems.length - 2} more items
                </p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleDownloadInvoice}
            disabled={!canDownloadInvoice || isDownloadingInvoice}
            className="w-full flex items-center justify-center space-x-1 sm:space-x-2 bg-gray-50 hover:bg-gray-100 text-gray-700 hover:text-gray-900 py-2 sm:py-3 px-3 sm:px-4 rounded-lg font-medium transition-all duration-200 group text-sm sm:text-base disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileText size={14} className="sm:w-4 sm:h-4" />
            <span>
              {isDownloadingInvoice
                ? "Preparing Invoice..."
                : canDownloadInvoice
                ? "Invoice PDF"
                : "Invoice after Confirmation"}
            </span>
          </button>
          {canProceedToPayment || isPayLaterDue ? (
            <button
              type="button"
              onClick={requestProceedToPayment}
              disabled={isAcceptingQuotation || payLaterPayment.isLoading}
              className={`w-full flex items-center justify-center space-x-1 sm:space-x-2 py-2 sm:py-3 px-3 sm:px-4 rounded-lg font-semibold transition-all duration-200 text-sm sm:text-base disabled:cursor-not-allowed ${
                isPayLaterDue
                  ? "bg-amber-600 hover:bg-amber-700 text-white disabled:bg-amber-300"
                  : "bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-300"
              }`}
            >
              {isAcceptingQuotation || payLaterPayment.isLoading ? (
                <MiniSpinner size={16} />
              ) : null}
              <span>
                {isPayLaterDue ? "Pay Due Amount" : "Proceed to Payment"}
              </span>
            </button>
          ) : (
            <Link
              href={`/orders/${toOrderReference(order.id)}`}
              className="w-full flex items-center justify-center space-x-1 sm:space-x-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-700 py-2 sm:py-3 px-3 sm:px-4 rounded-lg font-medium transition-all duration-200 group text-sm sm:text-base"
            >
              <span>Track Order</span>
              <ArrowRight
                size={14}
                className="sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform duration-200"
              />
            </Link>
          )}
          {canProceedToPayment || isPayLaterDue ? (
            <Link
              href={`/orders/${toOrderReference(order.id)}`}
              className="w-full sm:col-span-2 flex items-center justify-center space-x-1 sm:space-x-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-700 py-2 sm:py-3 px-3 sm:px-4 rounded-lg font-medium transition-all duration-200 group text-sm sm:text-base"
            >
              <span>Track Order</span>
              <ArrowRight
                size={14}
                className="sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform duration-200"
              />
            </Link>
          ) : null}
        </div>
      </div>

      <ConfirmModal
        isOpen={isProceedConfirmOpen}
        title={isPayLaterDue ? "Pay Due Amount?" : "Proceed to Payment?"}
        message={
          isPayLaterDue
            ? `You are about to settle the due amount of ${formatPrice(
                Number(order?.amount ?? 0)
              )}. You will be redirected to the payment gateway.`
            : "You are proceeding with payment for this quotation. You will be redirected to the payment gateway."
        }
        type="warning"
        confirmLabel={isPayLaterDue ? "Pay Due Amount" : "Proceed to Payment"}
        onConfirm={isPayLaterDue ? handleConfirmPayDue : handleConfirmProceedToPayment}
        onCancel={() => setIsProceedConfirmOpen(false)}
        isConfirming={isAcceptingQuotation || payLaterPayment.isLoading}
        disableCancelWhileConfirming
      />
    </motion.div>
  );
};

const UserOrders = () => {
  const { showToast } = useToast();
  const { data, isLoading, error } = useGetUserOrdersQuery(undefined, {
    pollingInterval: 15000,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const orders = data?.orders || [];
  const previousOrderStatusById = React.useRef<Record<string, string>>({});

  // Filter and sort state
  const [statusFilter, setStatusFilter] = React.useState("");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");

  React.useEffect(() => {
    if (!orders.length) {
      return;
    }

    const nextStatusMap: Record<string, string> = {};

    orders.forEach((order: any) => {
      const currentStatus = normalizeOrderStatus(order.status);
      const previousStatus = previousOrderStatusById.current[order.id];

      if (previousStatus && previousStatus !== currentStatus) {
        const orderReference = toOrderReference(order.id);
        showToast(
          `Order #${orderReference} is now ${getCustomerOrderStatusLabel(
            currentStatus
          )}.`,
          "info"
        );
      }

      nextStatusMap[order.id] = currentStatus;
    });

    previousOrderStatusById.current = nextStatusMap;
  }, [orders, showToast]);

  // Filter and sort orders
  const filteredAndSortedOrders = React.useMemo(() => {
    let filtered = orders;

    // Apply status filter
    if (statusFilter) {
      const normalizedFilterStatus = normalizeOrderStatus(statusFilter);
      filtered = filtered.filter((order: any) => {
        const orderStatus = normalizeOrderStatus(order.status);
        const paymentState = resolvePaymentState({
          isPayLater: order?.isPayLater,
          paymentDueDate: order?.paymentDueDate,
          paymentTransactions: order?.paymentTransactions,
          payment: order?.payment,
        });
        const isPayLaterDue =
          order?.isPayLater &&
          orderStatus === "DELIVERED" &&
          !!order?.paymentDueDate &&
          !paymentState.isPaid;

        if (normalizedFilterStatus === "AWAITING_PAYMENT") {
          return orderStatus === "AWAITING_PAYMENT" || isPayLaterDue;
        }

        return orderStatus === normalizedFilterStatus;
      });
    }

    // Apply sort order
    filtered = [...filtered].sort((a: any, b: any) => {
      const dateA = new Date(a.orderDate).getTime();
      const dateB = new Date(b.orderDate).getTime();
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  }, [orders, statusFilter, sortOrder]);

  const handleDownloadInvoice = React.useCallback(
    async (orderId: string) => {
      const order = orders.find((item: any) => item.id === orderId);
      if (
        !canDownloadInvoiceForOrder({
          status: order?.status,
          transactionStatus: order?.transaction?.status,
          isPayLater: order?.isPayLater,
          paymentDueDate: order?.paymentDueDate,
          paymentTransactions: order?.paymentTransactions,
          payment: order?.payment,
        })
      ) {
        showToast(
          "Invoice is generated after payment confirmation.",
          "info"
        );
        return;
      }

      try {
        await downloadInvoiceByOrderId(orderId);
        showToast("Invoice downloaded successfully", "success");
      } catch (downloadError: unknown) {
        const message =
          downloadError instanceof Error
            ? downloadError.message
            : "Failed to download invoice";
        showToast(message, "error");
      }
    },
    [orders, showToast]
  );

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center space-x-2 sm:space-x-3 mb-4 sm:mb-8"
        >
          <Package size={20} className="sm:w-6 sm:h-6 text-indigo-500" />
          <h1 className="type-h2 text-gray-800">
            Your Orders
          </h1>
        </motion.div>

        {/* Filters */}
        {!isLoading && orders.length > 0 && (
          <OrderFilters
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
          />
        )}

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
            {[...Array(6)].map((_, index) => (
              <OrderCardSkeleton key={index} />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <Package size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-lg text-red-500">
              Error loading orders
            </p>
            <p className="text-sm text-gray-600 mt-2">
              {(() => {
                const err = error as any;
                if (err?.data?.message) return err.data.message;
                if (err?.error) return err.error;
                if (err?.message) return err.message;
                if (err?.status) return `Server error: ${err.status}`;
                return "Please refresh and try again.";
              })()}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 inline-block text-indigo-500 hover:text-indigo-600 font-medium transition-colors duration-200"
            >
              Retry
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <Package size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-lg text-gray-600">You have no orders yet</p>
            <Link
              href="/shop"
              className="mt-4 inline-block text-indigo-500 hover:text-indigo-600 font-medium transition-colors duration-200"
            >
              Start Shopping
            </Link>
          </div>
        ) : filteredAndSortedOrders.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <Package
              size={40}
              className="sm:w-12 sm:h-12 mx-auto text-gray-400 mb-3 sm:mb-4"
            />
            <p className="text-base sm:text-lg text-gray-600">
              No orders match your filters
            </p>
            <button
              onClick={() => setStatusFilter("")}
              className="mt-3 sm:mt-4 inline-block text-indigo-500 hover:text-indigo-600 font-medium transition-colors duration-200"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
            {filteredAndSortedOrders.map((order: any) => (
              <OrderCard
                key={order.id}
                order={order}
                onDownloadInvoice={handleDownloadInvoice}
              />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default withAuth(UserOrders, { allowedRoles: ["USER", "DEALER"] });
