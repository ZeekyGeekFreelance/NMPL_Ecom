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
} from "lucide-react";
import Link from "next/link";
import { withAuth } from "@/app/components/HOC/WithAuth";
import OrderCardSkeleton from "@/app/components/feedback/OrderCardSkeleton";
import OrderFilters from "@/app/components/molecules/OrderFilters";
import useToast from "@/app/hooks/ui/useToast";
import { downloadInvoiceByOrderId } from "@/app/lib/utils/downloadInvoice";
import {
  canDownloadInvoiceForStatus,
  getCustomerOrderStatusLabel,
  normalizeOrderStatus,
} from "@/app/lib/orderLifecycle";
import { toOrderReference } from "@/app/lib/utils/accountReference";
import formatDate from "@/app/utils/formatDate";
import useFormatPrice from "@/app/hooks/ui/useFormatPrice";

// Status badge component
const StatusBadge = ({ status }: { status: string }) => {
  const getStatusConfig = (status: string) => {
    const normalizedStatus = normalizeOrderStatus(status);
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
    return (
      configs[normalizedStatus as keyof typeof configs] ||
      configs.PENDING_VERIFICATION
    );
  };

  const statusLabel = getCustomerOrderStatusLabel(status);
  const config = getStatusConfig(status);
  const IconComponent = config.icon;

  return (
    <div
      className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${config.color}`}
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

  const getItemCount = (orderItems: any[]) => {
    return (
      orderItems?.reduce(
        (total: number, item: any) => total + item.quantity,
        0
      ) || 0
    );
  };

  const orderReference = toOrderReference(order.id);
  const canDownloadInvoice = canDownloadInvoiceForStatus(order.status);

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
          <StatusBadge status={order.status} />
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
            onClick={() => onDownloadInvoice(order.id)}
            disabled={!canDownloadInvoice}
            className="w-full flex items-center justify-center space-x-1 sm:space-x-2 bg-gray-50 hover:bg-gray-100 text-gray-700 hover:text-gray-900 py-2 sm:py-3 px-3 sm:px-4 rounded-lg font-medium transition-all duration-200 group text-sm sm:text-base disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileText size={14} className="sm:w-4 sm:h-4" />
            <span>
              {canDownloadInvoice ? "Invoice PDF" : "Invoice after Confirmation"}
            </span>
          </button>
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
        </div>
      </div>
    </motion.div>
  );
};

const UserOrders = () => {
  const { showToast } = useToast();
  const { data, isLoading, error } = useGetUserOrdersQuery(undefined, {
    pollingInterval: 8000,
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
      filtered = filtered.filter(
        (order: any) =>
          normalizeOrderStatus(order.status) === normalizedFilterStatus
      );
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
      if (!canDownloadInvoiceForStatus(order?.status || "PENDING_VERIFICATION")) {
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
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
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
            <p className="text-lg text-red-500">
              Error loading orders: {"Unknown error"}
            </p>
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

export default withAuth(UserOrders, { allowedRoles: ["USER"] });

