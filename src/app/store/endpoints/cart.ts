import { apiSlice } from "../api.slice";

export const cartApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCart: builder.query<any, void>({
      query: () => "/cart",
      providesTags: ["Cart"],
    }),
    getCartCount: builder.query<{ count: number }, void>({
      query: () => "/cart/count",
      providesTags: ["Cart"],
    }),
    addToCart: builder.mutation<any, { variantId: string; quantity?: number }>({
      query: (body) => ({ url: "/cart", method: "POST", body }),
      invalidatesTags: ["Cart"],
    }),
    updateCartItem: builder.mutation<any, { id: string; quantity: number }>({
      query: ({ id, quantity }) => ({ url: `/cart/item/${id}`, method: "PUT", body: { quantity } }),
      invalidatesTags: ["Cart"],
    }),
    removeCartItem: builder.mutation<void, string>({
      query: (id) => ({ url: `/cart/item/${id}`, method: "DELETE" }),
      invalidatesTags: ["Cart"],
    }),
  }),
});

export const {
  useGetCartQuery,
  useGetCartCountQuery,
  useAddToCartMutation,
  useUpdateCartItemMutation,
  useRemoveCartItemMutation,
} = cartApi;
