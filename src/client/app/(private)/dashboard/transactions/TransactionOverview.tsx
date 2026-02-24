"use client";

import formatDate from "@/app/utils/formatDate";
import { getStatusColor } from "@/app/utils/getStatusColor";
import {
  toOrderReference,
  toTransactionReference,
} from "@/app/lib/utils/accountReference";

const getStatusLabel = (status: string) => {
  const normalizedStatus = status === "SHIPPED" ? "IN_TRANSIT" : status;

  const labels: Record<string, string> = {
    PENDING: "Order Placed",
    PROCESSING: "Confirmed",
    IN_TRANSIT: "Out for Delivery",
    DELIVERED: "Delivered",
  };

  return labels[normalizedStatus] || normalizedStatus;
};

const TransactionOverview = ({ transaction }) => {
  const normalizedStatus =
    transaction.status === "SHIPPED" ? "IN_TRANSIT" : transaction.status;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6 transition-all duration-200 hover:shadow-md">
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold mb-4">Transaction Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6">
            <div>
              <p className="text-sm text-gray-500">Transaction ID</p>
              <p className="font-mono">{toTransactionReference(transaction.id)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Order ID</p>
              <p className="font-mono">{toOrderReference(transaction.orderId)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Transaction Date</p>
              <p>{formatDate(transaction.transactionDate)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Last Updated</p>
              <p>{formatDate(transaction.updatedAt)}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <p className="text-sm text-gray-500 mb-1">Current Status</p>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
              normalizedStatus
            )}`}
          >
            {getStatusLabel(transaction.status)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TransactionOverview;

