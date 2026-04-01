import { apiSlice } from "../api.slice";

export const ordersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getOrders: builder.query<any, { page?: number; limit?: number }>({
      query: (params) => ({ url: "/orders", params }),
      providesTags: ["Orders"],
    }),
    getOrder: builder.query<any, string>({
      query: (id) => `/orders/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Orders", id }],
    }),
    getCheckoutSummary: builder.query<any, { addressId?: string; deliveryMode?: string }>({
      query: (params) => ({ url: "/checkout", params }),
    }),
    placeOrder: builder.mutation<any, any>({
      query: (body) => ({ url: "/checkout", method: "POST", body }),
      invalidatesTags: ["Orders", "Cart"],
    }),
  }),
});

export const {
  useGetOrdersQuery,
  useGetOrderQuery,
  useGetCheckoutSummaryQuery,
  usePlaceOrderMutation,
} = ordersApi;
