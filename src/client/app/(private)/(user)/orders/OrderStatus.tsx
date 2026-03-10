"use client";

import {
  CheckCircle,
  Clock,
  Package,
  Truck,
  XCircle,
  ShoppingBag,
} from "lucide-react";
import React from "react";
import { motion } from "framer-motion";
import getStatusStep from "@/app/utils/getStatusStep";
import formatDate from "@/app/utils/formatDate";
import {
  getCustomerOrderStatusLabel,
  getOrderStatusColor,
  normalizeOrderStatus,
  type OrderLifecycleStatus,
} from "@/app/lib/orderLifecycle";

const stepIndexByStatus: Record<OrderLifecycleStatus, number> = {
  PENDING_VERIFICATION: 1,
  WAITLISTED: 2,
  AWAITING_PAYMENT: 2,
  QUOTATION_REJECTED: 3,
  QUOTATION_EXPIRED: 3,
  CONFIRMED: 3,
  DELIVERED: 4,
};

const OrderStatus = ({ order }) => {
  const currentStatus = normalizeOrderStatus(
    order?.transaction?.status || order?.status,
  );

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
            className={`text-sm font-medium px-3 py-1 rounded-full flex items-center gap-1.5 ${getOrderStatusColor(
              currentStatus,
            )}`}
          >
            {getStatusIcon(currentStatus)}
            <span>{getCustomerOrderStatusLabel(currentStatus)}</span>
          </p>
        </div>
      </div>

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
