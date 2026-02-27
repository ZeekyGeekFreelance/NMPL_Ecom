"use client";
import { useInitiateCheckoutMutation } from "@/app/store/apis/CheckoutApi";
import React, { useMemo, useRef, useState } from "react";
import useToast from "@/app/hooks/ui/useToast";
import { motion } from "framer-motion";
import Link from "next/link";
import { useAuth } from "@/app/hooks/useAuth";
import { useRouter } from "next/navigation";
import { toOrderReference } from "@/app/lib/utils/accountReference";
import ConfirmModal from "@/app/components/organisms/ConfirmModal";
import useFormatPrice from "@/app/hooks/ui/useFormatPrice";

interface CartSummaryProps {
  subtotal: number;
  shippingRate?: number;
  totalItems: number;
}

const CartSummary: React.FC<CartSummaryProps> = ({
  subtotal,
  shippingRate = 0.01,
  totalItems,
}) => {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const formatPrice = useFormatPrice();
  const [isCheckoutConfirmOpen, setIsCheckoutConfirmOpen] = useState(false);
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);
  const checkoutInFlightRef = useRef(false);

  const [initiateCheckout, { isLoading }] = useInitiateCheckoutMutation();

  const shippingFee = useMemo(
    () => subtotal * shippingRate,
    [subtotal, shippingRate]
  );
  const total = useMemo(() => subtotal + shippingFee, [subtotal, shippingFee]);

  const handleInitiateCheckout = async () => {
    if (checkoutInFlightRef.current || isLoading) {
      return;
    }

    checkoutInFlightRef.current = true;
    setIsSubmittingCheckout(true);

    try {
      const res = await initiateCheckout(undefined).unwrap();
      const payload = (res as any)?.data ?? res;
      const orderId = payload?.orderId;
      const orderReference =
        payload?.orderReference || (orderId ? toOrderReference(orderId) : null);
      showToast(
        orderReference
          ? `Your order ${orderReference} has been placed successfully.`
          : "Your order has been placed successfully.",
        "success"
      );

      if (orderReference) {
        router.push(`/orders/${orderReference}`);
      } else if (orderId) {
        router.push(`/orders/${orderId}`);
      } else {
        router.push("/orders");
      }
    } catch (error: any) {
      showToast(error?.data?.message || "Failed to place order", "error");
    } finally {
      checkoutInFlightRef.current = false;
      setIsSubmittingCheckout(false);
    }
  };

  const handleCheckoutClick = () => {
    if (isLoading || isSubmittingCheckout || totalItems === 0) {
      return;
    }

    setIsCheckoutConfirmOpen(true);
  };

  const handleConfirmCheckout = async () => {
    if (isLoading || isSubmittingCheckout) {
      return;
    }

    setIsCheckoutConfirmOpen(false);
    await handleInitiateCheckout();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white rounded-lg p-6 sm:p-8 border border-gray-200"
      >
        <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4">
          Order Summary
        </h2>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between text-gray-700">
            <span>Total Items</span>
            <span>{totalItems}</span>
          </div>
          <div className="flex justify-between text-gray-700">
            <span>Subtotal</span>
            <span className="font-medium text-gray-800">
              {formatPrice(subtotal)}
            </span>
          </div>
          <div className="flex justify-between text-gray-700">
            <span>Shipping ({(shippingRate * 100).toFixed(0)}%)</span>
            <span className="font-medium text-gray-800">
              {formatPrice(shippingFee)}
            </span>
          </div>
          <div className="flex justify-between pt-3 border-t border-gray-200">
            <span className="font-semibold text-gray-800">Total</span>
            <span className="font-semibold text-gray-800">
              {formatPrice(total)}
            </span>
          </div>
        </div>

        {isAuthenticated ? (
          <button
            disabled={isLoading || isSubmittingCheckout || totalItems === 0}
            onClick={handleCheckoutClick}
            className="mt-4 w-full bg-indigo-600 text-white py-2.5 rounded-md font-medium text-sm hover:bg-indigo-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isLoading || isSubmittingCheckout
              ? "Processing..."
              : "Proceed to Checkout"}
          </button>
        ) : (
          <Link
            href="/sign-in"
            className="mt-4 w-full inline-block text-center bg-gray-300 text-gray-800 py-2.5 rounded-md font-medium text-sm hover:bg-gray-400 transition-colors"
          >
            Sign in to Checkout
          </Link>
        )}
      </motion.div>

      <ConfirmModal
        isOpen={isCheckoutConfirmOpen}
        title="Place Order?"
        type="warning"
        message="Are you sure you want to place this order now? Payment is currently managed outside the online gateway."
        onConfirm={handleConfirmCheckout}
        onCancel={() => setIsCheckoutConfirmOpen(false)}
        confirmLabel="Place Order"
        isConfirming={isSubmittingCheckout || isLoading}
        disableCancelWhileConfirming
      />
    </>
  );
};

export default CartSummary;
