import { apiSlice } from "../api.slice";

export const productsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getProducts: builder.query<any, Record<string, any>>({
      query: (params = {}) => ({ url: "/products", params }),
      providesTags: ["Products"],
    }),
    getProductBySlug: builder.query<any, string>({
      query: (slug) => `/products/slug/${slug}`,
      providesTags: (_r, _e, slug) => [{ type: "Products", id: slug }],
    }),
    getProductById: builder.query<any, string>({
      query: (id) => `/products/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Products", id }],
    }),
    createProduct: builder.mutation<any, any>({
      query: (body) => ({ url: "/products", method: "POST", body }),
      invalidatesTags: ["Products"],
    }),
    updateProduct: builder.mutation<any, { id: string; body: any }>({
      query: ({ id, body }) => ({ url: `/products/${id}`, method: "PUT", body }),
      invalidatesTags: ["Products"],
    }),
    deleteProduct: builder.mutation<void, string>({
      query: (id) => ({ url: `/products/${id}`, method: "DELETE" }),
      invalidatesTags: ["Products"],
    }),
  }),
});

export const {
  useGetProductsQuery,
  useGetProductBySlugQuery,
  useGetProductByIdQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
} = productsApi;
