"use client";

import { useParams, useSearchParams } from "next/navigation";
import MainLayout from "@/app/components/templates/MainLayout";
import ShippingAddressCard from "../ShippingAddressCard";
import OrderSummary from "../OrderSummary";
import OrderStatus from "../OrderStatus";
import OrderItems from "../OrderItems";
import { useGetOrderQuery } from "@/app/store/apis/OrderApi";
import CustomLoader from "@/app/components/feedback/CustomLoader";
import { withAuth } from "@/app/components/HOC/WithAuth";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";

const OrderTrackingPage = () => {
  const { orderId } = useParams();
  const searchParams = useSearchParams();
  const normalizedOrderId = Array.isArray(orderId) ? orderId[0] : orderId;
  const quotationActionParam = searchParams.get("quotationAction");
  const initialQuotationAction =
    quotationActionParam === "pay" || quotationActionParam === "reject"
      ? quotationActionParam
      : null;
  const { data, isLoading, error } = useGetOrderQuery(normalizedOrderId, {
    skip: !normalizedOrderId,
  });
  const order = data?.order || data?.data?.order;

  if (isLoading) {
    return (
      <MainLayout>
        <CustomLoader />
      </MainLayout>
    );
  }

  if (error || !order) {
    return (
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 py-8 text-sm text-red-600">
          {getApiErrorMessage(error, "Error loading order or order not found.")}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <OrderItems order={order} />

          <div className="col-span-2 space-y-6">
            <OrderStatus order={order} />

            <OrderSummary
              order={order}
              initialQuotationAction={initialQuotationAction}
            />
          </div>

          <ShippingAddressCard order={order} />
        </div>
      </div>
    </MainLayout>
  );
};

export default withAuth(OrderTrackingPage, { allowedRoles: ["USER", "DEALER"] });
