"use client";

import formatDate from "@/app/utils/formatDate";
import { Clock } from "lucide-react";
import {
  getPaymentAwareOrderStatusLabel,
  normalizeOrderStatus,
} from "@/app/lib/orderLifecycle";
import useFormatPrice from "@/app/hooks/ui/useFormatPrice";

const TimelineEvent = ({ date, title, description, isActive }) => {
  return (
    <div className="mb-4 relative">
      <div
        className={`absolute -left-6 mt-1 w-4 h-4 rounded-full ${
          isActive ? "bg-blue-500" : "bg-gray-300"
        }`}
      ></div>
      <p className="text-sm text-gray-500">{date}</p>
      <p className="font-medium">{title}</p>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
};

const TransactionTimeline = ({ transaction, payment, order }) => {
  const formatPrice = useFormatPrice();
  const currentStatus = normalizeOrderStatus(
    transaction?.status || "PENDING_VERIFICATION"
  );
  const isPendingVerification = currentStatus === "PENDING_VERIFICATION";
  const paymentAwareStatusLabel = getPaymentAwareOrderStatusLabel({
    status: transaction?.status,
    isPayLater: order?.isPayLater,
    paymentDueDate: order?.paymentDueDate,
    paymentTransactions: order?.paymentTransactions,
    payment: order?.payment,
  });
  const paymentTransactions = Array.isArray(order?.paymentTransactions)
    ? order.paymentTransactions
    : [];
  const latestPayment = paymentTransactions.find(
    (transaction: any) => transaction.status === "CONFIRMED"
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 transition-all duration-200 hover:shadow-md">
      <div className="flex items-center mb-4">
        <Clock className="mr-2 text-blue-600" size={20} />
        <h2 className="text-base sm:text-lg font-semibold">Transaction Timeline</h2>
      </div>
      <div className="border-l-2 border-gray-200 pl-4 ml-2">
        <TimelineEvent
          date={formatDate(transaction.createdAt || transaction.transactionDate)}
          title="Order submitted"
          description="Order entered stock verification queue."
          isActive={true}
        />

        {latestPayment ? (
          <TimelineEvent
            date={formatDate(latestPayment.paymentReceivedAt)}
            title="Payment received"
            description={`${latestPayment.paymentMethod} - ${formatPrice(
              Number(latestPayment.amount || 0)
            )}`}
            isActive={false}
          />
        ) : payment ? (
          <TimelineEvent
            date={formatDate(payment.createdAt)}
            title={payment.status === "PAID" ? "Payment processed" : "Payment pending"}
            description={`Status: ${payment.status}`}
            isActive={false}
          />
        ) : (
          <TimelineEvent
            date={formatDate(transaction.createdAt || transaction.transactionDate)}
            title="Payment pending"
            description="Quotation approval is required before payment."
            isActive={false}
          />
        )}

        {!isPendingVerification && (
          <TimelineEvent
          date={formatDate(transaction.updatedAt)}
          title="Status updated"
          description={`Current status: ${paymentAwareStatusLabel}`}
          isActive={false}
        />
      )}
      </div>
    </div>
  );
};

export default TransactionTimeline;
