"use client";

import {
  toOrderReference,
  toTransactionReference,
} from "@/app/lib/utils/accountReference";
import {
  getOrderStatusColor,
  getOrderStatusLabel,
  normalizeOrderStatus,
} from "@/app/lib/orderLifecycle";

const IST_TIMEZONE = "Asia/Kolkata";

const formatDateParts = (
  dateInput: string | number | Date | null | undefined
) => {
  if (!dateInput) {
    return { date: "N/A", time: "N/A" };
  }

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return { date: "N/A", time: "N/A" };
  }

  const dateText = new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);

  const timeText = `${new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date)} IST`;

  return { date: dateText, time: timeText };
};

const TransactionOverview = ({ transaction }) => {
  const normalizedStatus = normalizeOrderStatus(transaction.status);
  const transactionDate = formatDateParts(transaction.transactionDate);
  const updatedAt = formatDateParts(transaction.updatedAt);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6 transition-all duration-200 hover:shadow-md">
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-semibold mb-4">Transaction Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Transaction ID</p>
              <p className="font-mono mt-1">
                {toTransactionReference(transaction.id)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Order ID</p>
              <p className="font-mono mt-1">
                {toOrderReference(transaction.orderId)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Transaction Date</p>
              <p className="mt-2 text-sm font-medium text-gray-900">
                {"\u{1F4C5}"} {transactionDate.date}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {"\u{1F552}"} {transactionDate.time}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Last Updated</p>
              <p className="mt-2 text-sm font-medium text-gray-900">
                {"\u{1F4C5}"} {updatedAt.date}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {"\u{1F552}"} {updatedAt.time}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <p className="text-sm text-gray-500 mb-1">Current Status</p>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${getOrderStatusColor(
              normalizedStatus
            )}`}
          >
            {getOrderStatusLabel(transaction.status)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TransactionOverview;

