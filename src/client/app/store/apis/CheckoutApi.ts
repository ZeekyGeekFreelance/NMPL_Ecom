import { apiSlice } from "../slices/ApiSlice";

export const checkoutApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    initiateCheckout: builder.mutation<
      {
        orderId: string;
        orderReference?: string;
        status: string;
        message?: string;
      },
      void
    >({
      query: () => ({
        url: "/checkout",
        method: "POST",
        credentials: "include",
      }),
      invalidatesTags: ["Cart", "Order", "Transactions"],
    }),
  }),
});

export const { useInitiateCheckoutMutation } = checkoutApi;
