"use client";

import React, { useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import useFormatPrice from "@/app/hooks/ui/useFormatPrice";
import formatDate from "@/app/utils/formatDate";
import { Calendar, Download, Package, ShoppingBag } from "lucide-react";
import ToggleableText from "@/app/components/atoms/ToggleableText";
import useToast from "@/app/hooks/ui/useToast";
import { downloadInvoiceByOrderId } from "@/app/lib/utils/downloadInvoice";
import { toOrderReference } from "@/app/lib/utils/accountReference";

const OrderSummary = ({ order }) => {
  const formatPrice = useFormatPrice();
  const { showToast } = useToast();
  const orderStatus = order?.transaction?.status || order?.status || "PENDING";
  const canDownloadInvoice = orderStatus !== "PENDING";
  const shippingCost = 75.0;
  const platformFees = 94.0;
  const subtotal = order.amount;
  const total = useMemo(() => {
    return formatPrice(subtotal + shippingCost + platformFees);
  }, [subtotal, shippingCost, platformFees, formatPrice]);

  const handleDownloadInvoice = useCallback(async () => {
    if (!canDownloadInvoice) {
      showToast(
        "Invoice will be available after admin confirms your order.",
        "info"
      );
      return;
    }

    try {
      await downloadInvoiceByOrderId(order.id);
      showToast("Invoice downloaded successfully", "success");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to download invoice";
      showToast(message, "error");
    }
  }, [canDownloadInvoice, order.id, showToast]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="bg-white rounded-xl shadow-md p-6 border border-gray-100"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-gray-800">Order Details</h2>
        <button
          type="button"
          onClick={handleDownloadInvoice}
          disabled={!canDownloadInvoice}
          className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={15} />
          Invoice PDF
        </button>
      </div>
      {!canDownloadInvoice && (
        <p className="mb-4 text-xs text-amber-700">
          Invoice is generated only after admin confirmation.
        </p>
      )}

      {/* Order Details Section */}
      <div className="border-b border-gray-100 pb-4 mb-4">
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Package size={16} />
            <span className="font-medium text-gray-800">Tracking Number:</span>
            <ToggleableText
              content={order?.shipment?.trackingNumber || "Not available"}
              truncateLength={10}
            />
          </div>
          <div className="flex items-center space-x-2">
            <ShoppingBag size={16} />
            <span className="font-medium text-gray-800">Order ID:</span>
            <ToggleableText
              content={toOrderReference(order?.id || "")}
              truncateLength={12}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Calendar size={16} />
            <span className="font-medium text-gray-800">
              Placed on {formatDate(order.orderDate)}
            </span>
          </div>
        </div>
      </div>

      {/* Financial Summary Section */}
      <div className="space-y-3">
        <div className="flex justify-between text-gray-700">
          <p>Product Price</p>
          <div className="flex items-center space-x-4">
            <span className="text-gray-500">
              {order.orderItems.length} Item(s)
            </span>
            <span className="font-medium text-gray-800">
              {formatPrice(subtotal)}
            </span>
          </div>
        </div>
        <div className="flex justify-between text-gray-700">
          <p>Shipping Cost</p>
          <span className="font-medium text-gray-800">
            {formatPrice(shippingCost)}
          </span>
        </div>
        <div className="flex justify-between text-gray-700">
          <p>Platform Fees</p>
          <span className="font-medium text-gray-800">
            {formatPrice(platformFees)}
          </span>
        </div>
        <div className="flex justify-between pt-2 border-t border-gray-100">
          <p className="font-semibold text-gray-800">Total</p>
          <span className="font-semibold text-gray-800">{total}</span>
        </div>
      </div>
    </motion.div>
  );
};

export default OrderSummary;

