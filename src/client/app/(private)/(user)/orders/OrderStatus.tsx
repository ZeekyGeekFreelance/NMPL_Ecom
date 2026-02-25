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
  PLACED: 1,
  CONFIRMED: 2,
  REJECTED: 2,
  DELIVERED: 3,
};

const OrderStatus = ({ order }) => {
  const currentStatus = normalizeOrderStatus(
    order?.transaction?.status || order?.status
  );

  const getStatusIcon = (status: OrderLifecycleStatus) => {
    switch (status) {
      case "PLACED":
        return <Clock size={24} />;
      case "CONFIRMED":
        return <Package size={24} />;
      case "DELIVERED":
        return <Truck size={24} />;
      case "REJECTED":
        return <XCircle size={24} />;
      default:
        return <ShoppingBag size={24} />;
    }
  };

  const getStatusDate = (status: OrderLifecycleStatus) => {
    if (status === "PLACED") {
      return formatDate(order.createdAt || order.orderDate);
    }

    if (status === "CONFIRMED") {
      if (currentStatus === "CONFIRMED" || currentStatus === "DELIVERED") {
        return formatDate(order.transaction?.updatedAt || order.updatedAt);
      }
      return "Pending";
    }

    if (status === "DELIVERED") {
      if (order.shipment?.deliveryDate) {
        return formatDate(order.shipment.deliveryDate);
      }
      if (currentStatus === "DELIVERED") {
        return formatDate(order.transaction?.updatedAt || order.updatedAt);
      }
      return "Pending";
    }

    if (status === "REJECTED") {
      if (currentStatus === "REJECTED") {
        return formatDate(order.transaction?.updatedAt || order.updatedAt);
      }
      return "Pending";
    }

    return "N/A";
  };

  const timelineStatuses: OrderLifecycleStatus[] =
    currentStatus === "REJECTED"
      ? ["PLACED", "REJECTED"]
      : ["PLACED", "CONFIRMED", "DELIVERED"];

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
            className={`font-medium px-3 py-1 rounded-full flex items-center ${getOrderStatusColor(
              currentStatus
            )}`}
          >
            {getStatusIcon(currentStatus)}
            <span className="ml-2">
              {getCustomerOrderStatusLabel(currentStatus)}
            </span>
          </p>
        </div>
      </div>

      {currentStatus === "REJECTED" && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          This order has been cancelled after manual review. If you need help,
          contact support.
        </div>
      )}

      <div className="relative mt-6">
        <div
          className="absolute top-5 left-0 h-1 bg-gray-200 w-full"
          style={{ zIndex: 1 }}
        />
        <div
          className="absolute top-5 left-0 h-1 bg-blue-500 transition-all duration-500"
          style={{
            zIndex: 2,
            width: `${
              ((currentStep - 1) / Math.max(timelineStatuses.length - 1, 1)) *
              100
            }%`,
          }}
        />

        <div className="relative z-10 flex items-start justify-between gap-3">
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
                  className={`w-12 h-12 rounded-md flex items-center justify-center mb-2 ${
                    active
                      ? "bg-blue-100 text-blue-500"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {status === "DELIVERED" ? (
                    <CheckCircle size={24} />
                  ) : (
                    getStatusIcon(status)
                  )}
                </div>
                <span className="text-sm font-medium">
                  {getCustomerOrderStatusLabel(status)}
                </span>
                <span className="text-xs text-gray-500">
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
