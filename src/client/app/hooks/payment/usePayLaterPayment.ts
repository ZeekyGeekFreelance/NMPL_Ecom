"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import useToast from "@/app/hooks/ui/useToast";
import { useAuth } from "@/app/hooks/useAuth";
import {
  useCreateGatewayPaymentOrderMutation,
  useProcessGatewayPaymentMutation,
} from "@/app/store/apis/PaymentApi";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";
import { toOrderReference } from "@/app/lib/utils/accountReference";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

const loadScript = (src: string) =>
  new Promise<boolean>((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const unwrapPaymentOrderPayload = (response: any) => {
  const root = response?.data ?? response;
  const payload = root?.data ?? root;
  return {
    razorpayOrder:
      payload?.razorpayOrder || payload?.data?.razorpayOrder || null,
    gatewayConfig:
      payload?.gatewayConfig || payload?.data?.gatewayConfig || null,
    orderDetails:
      payload?.orderDetails || payload?.data?.orderDetails || null,
  };
};

const buildMockPaymentId = () =>
  `pay_mock_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

type PayLaterPaymentOptions = {
  onSuccess?: () => void;
};

export const usePayLaterPayment = (
  order: any,
  options?: PayLaterPaymentOptions
) => {
  const router = useRouter();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [createPaymentOrder, { isLoading: isCreating }] =
    useCreateGatewayPaymentOrderMutation();
  const [processGatewayPayment, { isLoading: isProcessing }] =
    useProcessGatewayPaymentMutation();
  const [isStarting, setIsStarting] = useState(false);

  const handleSuccess = useCallback(() => {
    showToast("Payment recorded successfully.", "success");
    if (options?.onSuccess) {
      options.onSuccess();
      return;
    }
    router.push("/payment-success");
  }, [options, router, showToast]);

  const startPayment = useCallback(async () => {
    if (!order?.id) {
      showToast("Order details are unavailable.", "error");
      return;
    }

    if (!user?.email || !user?.name) {
      showToast("Your profile is missing contact details.", "error");
      return;
    }

    setIsStarting(true);

    try {
      const response = await createPaymentOrder({
        orderId: order.id,
        customerEmail: user.email,
        customerName: user.name,
        customerPhone:
          user.phone ||
          order?.address?.phoneNumber ||
          order?.address?.phone ||
          undefined,
      }).unwrap();

      const { razorpayOrder, gatewayConfig, orderDetails } =
        unwrapPaymentOrderPayload(response);

      if (!razorpayOrder?.razorpayOrderId || !gatewayConfig?.keyId) {
        showToast(
          "Payment gateway is unavailable right now. Please try again.",
          "error"
        );
        return;
      }

      const amount = Number(
        orderDetails?.amount ?? razorpayOrder?.amount ?? order?.amount ?? 0
      );

      if (!amount || Number.isNaN(amount)) {
        showToast("Unable to determine payable amount.", "error");
        return;
      }

      const isMock =
        gatewayConfig?.isMockMode || razorpayOrder?.isMockPayment;

      if (isMock) {
        await processGatewayPayment({
          orderId: order.id,
          paymentMethod: "UPI",
          amount,
          razorpayOrderId: razorpayOrder.razorpayOrderId,
          razorpayPaymentId: buildMockPaymentId(),
          razorpaySignature: "mock_signature",
          gatewayPayload: {
            mock: true,
            orderReference: toOrderReference(order.id),
          },
        }).unwrap();
        handleSuccess();
        return;
      }

      const scriptLoaded = await loadScript(
        "https://checkout.razorpay.com/v1/checkout.js"
      );

      if (!scriptLoaded || typeof window === "undefined" || !window.Razorpay) {
        showToast("Payment gateway failed to load.", "error");
        return;
      }

      const options = {
        key: gatewayConfig.keyId,
        amount: Math.round(amount * 100),
        currency: razorpayOrder.currency || "INR",
        name: "Order Payment",
        description: `Payment for ${toOrderReference(order.id)}`,
        order_id: razorpayOrder.razorpayOrderId,
        prefill: {
          name: user.name,
          email: user.email,
          contact: user.phone || "",
        },
        handler: async (response: any) => {
          try {
            await processGatewayPayment({
              orderId: order.id,
              paymentMethod: "UPI",
              amount,
              razorpayOrderId: response?.razorpay_order_id,
              razorpayPaymentId: response?.razorpay_payment_id,
              razorpaySignature: response?.razorpay_signature,
              gatewayPayload: response,
            }).unwrap();
            handleSuccess();
          } catch (error: unknown) {
            showToast(
              getApiErrorMessage(
                error,
                "Payment verification failed. Please try again."
              ),
              "error"
            );
          }
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on("payment.failed", () => {
        showToast("Payment failed. Please try again.", "error");
      });
      razorpay.open();
    } catch (error: unknown) {
      showToast(
        getApiErrorMessage(error, "Unable to start payment for this order."),
        "error"
      );
    } finally {
      setIsStarting(false);
    }
  }, [
    createPaymentOrder,
    handleSuccess,
    order,
    processGatewayPayment,
    showToast,
    user,
  ]);

  return {
    startPayment,
    isLoading: isCreating || isProcessing || isStarting,
  };
};
