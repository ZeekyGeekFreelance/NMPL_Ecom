"use client";
import BreadCrumb from "@/app/components/feedback/BreadCrumb";
import MainLayout from "@/app/components/templates/MainLayout";
import { Trash2, ShoppingCart, Minus, Plus, ShieldAlert } from "lucide-react";
import React, { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import CartSummary from "@/app/(public)/cart/CartSummary";
import ConfirmModal from "@/app/components/organisms/ConfirmModal";
import {
  useGetCartQuery,
  useRemoveFromCartMutation,
  useUpdateCartItemMutation,
} from "@/app/store/apis/CartApi";
import { motion } from "framer-motion";
import CartSkeletonLoader from "@/app/components/feedback/CartSkeletonLoader";
import { generateProductPlaceholder } from "@/app/utils/placeholderImage";
import { useAuth } from "@/app/hooks/useAuth";
import useFormatPrice from "@/app/hooks/ui/useFormatPrice";
import useToast from "@/app/hooks/ui/useToast";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";
import {
  isAdminDisplayRole,
  isCustomerDisplayRole,
  resolveDisplayRole,
} from "@/app/lib/userRole";
import { runtimeEnv } from "@/app/lib/runtimeEnv";

const isDevelopment = runtimeEnv.isDevelopment;
const debugLog = (...args: unknown[]) => {
  if (isDevelopment) {
    console.log(...args);
  }
};

// Helper function to format variant name from SKU
const formatVariantName = (item: any) => {
  const { name } = item.variant.product;
  const sku = item.variant.sku;
  // Parse SKU (e.g., "TSH-RED-M" -> "Red, Medium")
  const parts = sku.split("-").slice(1); // Remove prefix (e.g., "TSH")
  const variantDetails = parts.join(", "); // Join color and size
  return `${name} - ${variantDetails}`;
};

const Cart = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const formatPrice = useFormatPrice();
  const { showToast } = useToast();
  const displayRole = resolveDisplayRole(user);
  const isCustomerUser =
    isAuthenticated && isCustomerDisplayRole(displayRole);
  const isAdminOrSuperAdmin =
    isAuthenticated && isAdminDisplayRole(displayRole);
  const shouldLoadCart = isCustomerUser;

  const { data, isLoading: userCartLoading } = useGetCartQuery(undefined, {
    skip: !shouldLoadCart,
  });
  const [removeFromCart, { isLoading: isRemovingFromCart }] =
    useRemoveFromCartMutation();
  const [updateCartItem] = useUpdateCartItemMutation();
  const [itemPendingRemoval, setItemPendingRemoval] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const cartItems = useMemo(
    () => (shouldLoadCart ? data?.cart?.cartItems || [] : []),
    [data?.cart?.cartItems, shouldLoadCart]
  );

  const isLoading = authLoading || (shouldLoadCart && userCartLoading);
  debugLog("items => ", cartItems);

  const subtotal = useMemo(() => {
    if (!cartItems.length) return 0;
    return cartItems.reduce(
      (sum, item) => sum + item.variant.price * item.quantity,
      0
    );
  }, [cartItems]);

  const totalItems = useMemo(() => {
    if (!cartItems.length) return 0;
    return cartItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [cartItems]);
  debugLog("subtotal => ", subtotal);

  const requestRemoveFromCart = (item: any) => {
    setItemPendingRemoval({
      id: item.id,
      name: formatVariantName(item),
    });
  };

  const handleRemoveFromCart = async () => {
    const pendingRemoval = itemPendingRemoval;
    if (!pendingRemoval) {
      return;
    }

    setItemPendingRemoval(null);

    try {
      await removeFromCart(pendingRemoval.id).unwrap();
      showToast("Item removed from cart", "success");
    } catch (error) {
      showToast(
        getApiErrorMessage(error, "Failed to remove item from cart"),
        "error"
      );
      console.error("Error removing item:", error);
    }
  };

  const handleQuantityChange = async (item: any, delta: number) => {
    const nextQuantity = item.quantity + delta;
    if (nextQuantity < 1) {
      return;
    }

    try {
      await updateCartItem({ id: item.id, quantity: nextQuantity }).unwrap();
    } catch (error) {
      showToast(
        getApiErrorMessage(error, "Failed to update item quantity"),
        "error"
      );
      console.error("Error updating item:", error);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <BreadCrumb />

        {/* Cart Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center space-x-2 mt-4 mb-6"
        >
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">
            Your Cart
          </h1>
          <span className="text-gray-500 text-sm">
            ({totalItems} items)
          </span>
        </motion.div>

        {!authLoading && !isAuthenticated ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 mb-6 text-center">
            <p className="text-sm text-gray-700">
              Sign in to view your cart.
            </p>
            <Link
              href="/sign-in?next=%2Fcart"
              className="mt-3 inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Sign in
            </Link>
          </div>
        ) : isAdminOrSuperAdmin ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-6">
            <div className="flex items-start gap-3">
              <ShieldAlert size={18} className="text-amber-700 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  Cart is disabled for admin accounts
                </p>
                <p className="text-sm text-amber-800 mt-1">
                  Cart and checkout are restricted to `USER` role only.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Cart Content */}
        {!isAuthenticated || isAdminOrSuperAdmin ? null : isLoading ? (
          <CartSkeletonLoader />
        ) : cartItems.length === 0 ? (
          <div className="text-center py-10">
            <ShoppingCart size={40} className="mx-auto text-gray-400 mb-3" />
            <p className="text-base sm:text-lg text-gray-600">
              Your cart is empty
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {/* Cart Items */}
            <div className="space-y-4">
              {cartItems.map((item) => {
                const productSlug = item?.variant?.product?.slug;
                const productHref = productSlug ? `/product/${productSlug}` : "/shop";

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="bg-white rounded-lg p-4 sm:p-6 border border-gray-200 flex flex-col sm:flex-row items-start sm:items-center gap-4"
                  >
                    {/* Product Image */}
                    <Link
                      href={productHref}
                      className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-50 rounded flex items-center justify-center overflow-hidden"
                    >
                      <Image
                        src={
                          item?.variant?.images[0] ||
                          generateProductPlaceholder(item.variant.product.name)
                        }
                        alt={formatVariantName(item)}
                        width={80}
                        height={80}
                        className="object-cover"
                        sizes="(max-width: 640px) 64px, 80px"
                        onError={(e) => {
                          e.currentTarget.src = generateProductPlaceholder(
                            item.variant.product.name
                          );
                        }}
                      />
                    </Link>

                    {/* Variant Details */}
                    <div className="flex-1">
                      <Link
                        href={productHref}
                        className="font-medium text-gray-800 text-sm sm:text-base hover:text-indigo-600 transition-colors"
                      >
                        {formatVariantName(item)}
                      </Link>
                      <p className="text-xs text-gray-500">
                        SKU: {item.variant.sku}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500">
                        {formatPrice(item.variant.price)}
                      </p>
                    </div>

                    {/* Quantity Selector */}
                    <div className="flex items-center gap-2 rounded-full max-w-fit border border-gray-300 bg-white px-2 py-1">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(item, -1)}
                        disabled={item.quantity <= 1}
                        className="rounded-full p-2 transition hover:bg-gray-100 disabled:opacity-50"
                      >
                        <Minus size={16} />
                      </button>

                      <span className="min-w-[32px] text-center font-semibold text-gray-800">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleQuantityChange(item, 1)}
                        disabled={
                          item.quantity >=
                          Math.max(
                            0,
                            (Number(item.variant.stock) || 0) -
                              (Number(item.variant.reservedStock) || 0)
                          )
                        }
                        className="rounded-full p-2 transition hover:bg-gray-100 disabled:opacity-50"
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    {/* Subtotal and Remove */}
                    <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2 w-full sm:w-auto">
                      <p className="font-medium text-gray-800 text-sm sm:text-base">
                        {formatPrice(item.variant.price * item.quantity)}
                      </p>
                      <button
                        type="button"
                        onClick={() => requestRemoveFromCart(item)}
                        className="text-red-500 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Cart Summary */}
            <CartSummary
              subtotal={subtotal}
              totalItems={totalItems}
            />
          </div>
        )}
      </div>
      <ConfirmModal
        isOpen={itemPendingRemoval !== null}
        title="Remove item from cart?"
        message={`Do you want to remove \"${itemPendingRemoval?.name || "this item"}\" from your cart?`}
        type="danger"
        confirmLabel="Remove"
        onConfirm={() => void handleRemoveFromCart()}
        onCancel={() => setItemPendingRemoval(null)}
        isConfirming={isRemovingFromCart}
        disableCancelWhileConfirming
      />
    </MainLayout>
  );
};

export default Cart;

