"use client";

import useFormatPrice from "@/app/hooks/ui/useFormatPrice";
import formatDate from "@/app/utils/formatDate";
import { ShoppingBag } from "lucide-react";
import { toOrderReference } from "@/app/lib/utils/accountReference";

const OrderInformation = ({ order, className = "" }) => {
  const format = useFormatPrice();

  if (!order) {
    return (
      <div
        className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 transition-all duration-200 hover:shadow-md ${className}`}
      >
        <div className="flex items-center mb-4">
          <ShoppingBag className="mr-2 text-blue-600" size={20} />
          <h2 className="text-lg font-semibold">Order Information</h2>
        </div>
        <p className="text-sm text-gray-500">Order information is not available.</p>
      </div>
    );
  }

  const orderItems = Array.isArray(order.orderItems) ? order.orderItems : [];

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 transition-all duration-200 hover:shadow-md ${className}`}
    >
      <div className="flex items-center mb-4">
        <ShoppingBag className="mr-2 text-blue-600" size={20} />
        <h2 className="text-lg font-semibold">Order Information</h2>
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
      </div>

      {/* Order Items */}
      <div className="mt-6">
        <h3 className="text-md font-semibold mb-3">Order Items</h3>
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
                    {index + 1}
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
    </div>
  );
};

export default OrderInformation;
