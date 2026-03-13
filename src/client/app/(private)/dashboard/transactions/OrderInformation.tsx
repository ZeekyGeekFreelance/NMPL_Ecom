"use client";

import useFormatPrice from "@/app/hooks/ui/useFormatPrice";
import formatDate from "@/app/utils/formatDate";
import { ShoppingBag } from "lucide-react";
import { toOrderReference } from "@/app/lib/utils/accountReference";
import { getPaginatedSerialNumber } from "@/app/lib/utils/pagination";

const quotationEventLabel: Record<string, string> = {
  ORIGINAL_ORDER: "Original Order",
  ADMIN_QUOTATION: "Admin Quotation",
  CUSTOMER_ACCEPTED: "Customer Accepted",
  CUSTOMER_REJECTED: "Customer Rejected",
  QUOTATION_EXPIRED: "Quotation Expired",
  PAYMENT_CONFIRMED: "Payment Confirmed",
};

const getAmountContextLabel = (event: string) => {
  if (event === "ORIGINAL_ORDER") {
    return {
      previousLabel: "Actual Order Price",
      updatedLabel: "Actual Order Price",
    };
  }

  if (event === "ADMIN_QUOTATION") {
    return {
      previousLabel: "Previous Quotation",
      updatedLabel: "Updated Quotation",
    };
  }

  if (event === "CUSTOMER_ACCEPTED" || event === "PAYMENT_CONFIRMED") {
    return {
      previousLabel: "Quoted Price",
      updatedLabel: "Accepted At Price",
    };
  }

  return {
    previousLabel: "Previous Price",
    updatedLabel: "Updated Price",
  };
};

const OrderInformation = ({ order, className = "" }) => {
  const format = useFormatPrice();

  if (!order) {
    return (
      <div
        className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 transition-all duration-200 hover:shadow-md ${className}`}
      >
        <div className="flex items-center mb-4">
          <ShoppingBag className="mr-2 text-blue-600" size={20} />
          <h2 className="text-base sm:text-lg font-semibold">Order Information</h2>
        </div>
        <p className="text-sm text-gray-500">Order information is not available.</p>
      </div>
    );
  }

  const orderItems = Array.isArray(order.orderItems) ? order.orderItems : [];
  const quotationLogs = Array.isArray(order.quotationLogs)
    ? order.quotationLogs
    : [];

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 transition-all duration-200 hover:shadow-md ${className}`}
    >
      <div className="flex items-center mb-4">
        <ShoppingBag className="mr-2 text-blue-600" size={20} />
        <h2 className="text-base sm:text-lg font-semibold">Order Information</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6">
        <div>
          <p className="text-sm text-gray-500">Order ID</p>
          <p className="font-mono">{toOrderReference(order.id)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Order Amount</p>
          <p className="font-medium">{format(order.amount)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Order Date</p>
          <p>{formatDate(order.orderDate)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Created At</p>
          <p>{formatDate(order.createdAt)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Updated At</p>
          <p>{formatDate(order.updatedAt)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Reservation Status</p>
          <p>{order.reservation?.status || "NONE"}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Reservation Expires</p>
          <p>
            {order.reservation?.expiresAt || order.reservationExpiresAt
              ? formatDate(order.reservation?.expiresAt || order.reservationExpiresAt)
              : "N/A"}
          </p>
        </div>
      </div>

      {/* Order Items */}
      <div className="mt-6">
        <h3 className="text-sm sm:text-base font-semibold mb-3">Order Items</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SN No.
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Variant
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit Price
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Line Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orderItems.map((item, index) => (
                <tr
                  key={item.id}
                  className="hover:bg-gray-50 transition-colors duration-150"
                >
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-700">
                    {getPaginatedSerialNumber(index)}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm">
                    {item.variant?.product?.name || "Unknown Product"}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-mono">
                    {item.variant?.sku || item.variantId || "-"}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm">
                    {item.quantity}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm">
                    {format(item.price)}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-semibold text-gray-800">
                    {format(item.price * item.quantity)}
                  </td>
                </tr>
              ))}
              {orderItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-4 text-sm text-gray-500 text-center"
                  >
                    No order items found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm sm:text-base font-semibold mb-3">Quotation History</h3>
        {quotationLogs.length === 0 ? (
          <p className="text-sm text-gray-500">
            No quotation revisions recorded yet.
          </p>
        ) : (
          <div className="space-y-3">
            {quotationLogs.map((log: any) => {
              const amountLabels = getAmountContextLabel(String(log.event || ""));
              const lineItems = Array.isArray(log.lineItems) ? log.lineItems : [];
              const showPreviousAmount =
                String(log.event || "") !== "ORIGINAL_ORDER" &&
                log.previousTotal !== null &&
                log.previousTotal !== undefined;

              return (
                <div
                  key={log.id}
                  className="rounded-md border border-gray-200 bg-gray-50 p-3"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-gray-800">
                      {quotationEventLabel[String(log.event || "")] ||
                        String(log.event || "Quotation Update")}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(log.createdAt)}
                    </p>
                  </div>
                  <div
                    className={`mt-2 grid grid-cols-1 gap-2 text-sm ${
                      showPreviousAmount ? "sm:grid-cols-2" : "sm:grid-cols-1"
                    }`}
                  >
                    {showPreviousAmount ? (
                      <p>
                        <span className="text-gray-500">
                          {amountLabels.previousLabel}:
                        </span>{" "}
                        <span className="font-medium">
                          {format(Number(log.previousTotal))}
                        </span>
                      </p>
                    ) : null}
                    <p>
                      <span className="text-gray-500">
                        {amountLabels.updatedLabel}:
                      </span>{" "}
                      <span className="font-semibold text-gray-900">
                        {format(Number(log.updatedTotal || 0))}
                      </span>
                    </p>
                  </div>
                  {log.message ? (
                    <p className="mt-2 text-xs text-gray-600">{log.message}</p>
                  ) : null}
                  {lineItems.length > 0 ? (
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-white">
                          <tr>
                            <th className="px-2 py-1 text-left font-medium text-gray-500">
                              Product
                            </th>
                            <th className="px-2 py-1 text-left font-medium text-gray-500">
                              SKU
                            </th>
                            <th className="px-2 py-1 text-left font-medium text-gray-500">
                              Qty
                            </th>
                            <th className="px-2 py-1 text-left font-medium text-gray-500">
                              Unit
                            </th>
                            <th className="px-2 py-1 text-left font-medium text-gray-500">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {lineItems.map((line: any) => (
                            <tr key={`${log.id}-${line.orderItemId || line.variantId}`}>
                              <td className="px-2 py-1">
                                {line.productName || "Product"}
                              </td>
                              <td className="px-2 py-1 font-mono">
                                {line.sku || line.variantId || "N/A"}
                              </td>
                              <td className="px-2 py-1">{line.quantity}</td>
                              <td className="px-2 py-1">
                                {format(Number(line.unitPrice || 0))}
                              </td>
                              <td className="px-2 py-1 font-medium">
                                {format(Number(line.lineTotal || 0))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderInformation;
