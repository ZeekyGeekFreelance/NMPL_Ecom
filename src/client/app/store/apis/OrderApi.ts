import { apiSlice } from "../slices/ApiSlice";

export const orderApi = apiSlice.injectEndpoints({
  overrideExisting: false,
  endpoints: (builder) => ({
    /**
     * GET /orders/:orderId
     * Works for both the order's owner AND admins.
     * Used by PaymentRecordingForm and PaymentAuditModal to load order details.
     */
    getOrderById: builder.query<{ order: any }, string>({
      query: (orderId) => `/orders/${orderId}`,
      providesTags: (result, error, id) => [{ type: "Order", id }],
    }),

    /** Alias — kept for any callers that still import useGetOrderQuery */
    getOrder: builder.query<{ order: any }, string>({
      query: (orderId) => `/orders/${orderId}`,
      providesTags: (result, error, id) => [{ type: "Order", id }],
    }),

    /**
     * POST /orders/:orderId/quotation/accept
     * Accepts the latest quotation and starts payment (or confirms pay-later).
     */
    acceptQuotation: builder.mutation<any, string>({
      query: (orderId) => ({
        url: `/orders/${orderId}/quotation/accept`,
        method: "POST",
      }),
      invalidatesTags: (result, error, id) => [{ type: "Order", id }, "Order"],
    }),

    /**
     * POST /orders/:orderId/quotation/reject
     * Rejects the latest quotation.
     */
    rejectQuotation: builder.mutation<any, string>({
      query: (orderId) => ({
        url: `/orders/${orderId}/quotation/reject`,
        method: "POST",
      }),
      invalidatesTags: (result, error, id) => [{ type: "Order", id }, "Order"],
    }),

    /**
     * GET /orders/user
     * Returns all orders for the authenticated user/dealer.
     * NOT /orders — that endpoint is ADMIN-only (getAllOrders).
     */
    getUserOrders: builder.query<{ orders: any[] }, void>({
      query: () => `/orders/user`,
      providesTags: ["Order"],
    }),
  }),
});

export const {
  useGetOrderByIdQuery,
  useGetOrderQuery,
  useAcceptQuotationMutation,
  useRejectQuotationMutation,
  useGetUserOrdersQuery,
} = orderApi;
