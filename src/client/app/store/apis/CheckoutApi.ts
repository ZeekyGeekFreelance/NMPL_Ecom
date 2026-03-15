import { apiSlice } from "../slices/ApiSlice";

export type CheckoutDeliveryMode = "PICKUP" | "DELIVERY";

export type CheckoutSelectionPayload = {
  addressId?: string;
  deliveryMode: CheckoutDeliveryMode;
  /** Live total from the preceding summary step — triggers server-side drift guard. */
  expectedTotal?: number;
};

export type CheckoutSummary = {
  cartId: string;
  subtotalAmount: number;
  deliveryMode: CheckoutDeliveryMode;
  deliveryLabel: string;
  deliveryCharge: number;
  finalTotal: number;
  serviceArea?: string | null;
  selectedAddress: {
    id: string;
    type: "HOME" | "OFFICE" | "WAREHOUSE" | "OTHER";
    fullName: string;
    phoneNumber: string;
    line1: string;
    line2?: string | null;
    landmark?: string | null;
    city: string;
    state: string;
    country: string;
    pincode: string;
  };
};

export const checkoutApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCheckoutSummary: builder.mutation<
      CheckoutSummary,
      CheckoutSelectionPayload
    >({
      query: (body) => ({
        url: "/checkout/summary",
        method: "POST",
        body,
      }),
    }),
    initiateCheckout: builder.mutation<
      {
        orderId: string;
        orderReference?: string;
        status: string;
        subtotalAmount: number;
        deliveryCharge: number;
        deliveryMode: CheckoutDeliveryMode;
        finalTotal: number;
        message?: string;
      },
      CheckoutSelectionPayload
    >({
      query: (body) => ({
        url: "/checkout",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Cart", "Order", "Transactions"],
    }),
  }),
});

export const { useGetCheckoutSummaryMutation, useInitiateCheckoutMutation } =
  checkoutApi;
