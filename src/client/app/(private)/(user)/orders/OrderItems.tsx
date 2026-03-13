"use client";

import React from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import useFormatPrice from "@/app/hooks/ui/useFormatPrice";
import { ShoppingCart } from "lucide-react";
import { generateProductPlaceholder } from "@/app/utils/placeholderImage";

// Helper function to format variant name from SKU
const formatVariantName = (item: any) => {
  const name = item?.variant?.product?.name || "Product";
  const sku = item?.variant?.sku || "";
  // Parse SKU (e.g., "TSH-BLUE-L" -> "Blue, Large")
  const parts = sku.split("-").slice(1); // Remove prefix (e.g., "TSH")
  const variantDetails = parts.join(", "); // Join color and size
  return variantDetails ? `${name} - ${variantDetails}` : name;
};

const OrderItems = ({ order }) => {
  const formatPrice = useFormatPrice();

  const getVariantParts = (item: any) => {
    const sku = String(item?.variant?.sku || "");
    const parts = sku ? sku.split("-").slice(1) : [];
    return parts.join(", ");
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="col-span-1 bg-white rounded-xl h-fit overflow-auto shadow-md p-6 border border-gray-100 hover:shadow-lg transition-shadow duration-300"
    >
      <div className="flex items-center space-x-2 mb-4">
        <ShoppingCart size={18} />
        <h2 className="text-sm sm:text-base font-semibold text-gray-800">Order Items</h2>
      </div>

      <div className="space-y-4">
        {(Array.isArray(order?.orderItems) ? order.orderItems : []).map((item) => {
          const productSlug = item?.variant?.product?.slug;
          const productHref = productSlug ? `/product/${productSlug}` : "/shop";
          const unitPrice = Number(item?.price ?? item?.variant?.price ?? 0);
          const quantity = Number(item?.quantity ?? 0);
          const lineTotal = unitPrice * quantity;
          const productName = item?.variant?.product?.name || "Product";
          const variantDetails = getVariantParts(item);
          const imageSrc =
            item?.variant?.images?.[0] || generateProductPlaceholder(productName);

          return (
            <div
              key={item.id}
              className="flex items-start gap-4 border-b border-gray-100 pb-4 last:border-0 last:pb-0"
            >
              {/* Variant Image */}
              <Link
                href={productHref}
                className="flex items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50 shadow-sm"
              >
                <Image
                  src={imageSrc}
                  alt={formatVariantName(item)}
                  width={56}
                  height={56}
                  className="h-14 w-14 object-cover"
                />
              </Link>

              {/* Variant Details */}
              <div className="flex-1 min-w-0">
                <Link
                  href={productHref}
                  className="font-semibold text-gray-900 text-sm hover:text-indigo-600 transition-colors"
                >
                  <span className="block truncate">{productName}</span>
                </Link>
                {variantDetails ? (
                  <p className="mt-1 text-xs text-gray-500 truncate">
                    {variantDetails}
                  </p>
                ) : null}
              </div>

              {/* Price */}
              <div className="text-right shrink-0">
                <p className="font-semibold text-gray-900">
                  {formatPrice(lineTotal)}
                </p>
                <p className="text-[11px] text-gray-500">
                  {quantity} × {formatPrice(unitPrice)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default OrderItems;
