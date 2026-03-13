import { apiSlice } from "../slices/ApiSlice";

export const transactionApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAllTransactions: builder.query({
      query: (params?: { page?: number; limit?: number }) => ({
        url: "/transactions",
        params: params || undefined,
      }),
      providesTags: ["Transactions"],
    }),
    getTransaction: builder.query({
      query: (id) => `/transactions/${id}`,
      providesTags: (result, error, id) => [{ type: "Transactions", id }],
    }),

    updateTransactionStatus: builder.mutation({
      query: ({
        id,
        status,
        forceConfirmedRejection,
        confirmationToken,
      }: {
        id: string;
        status: string;
        forceConfirmedRejection?: boolean;
        confirmationToken?: string;
      }) => ({
        url: `/transactions/status/${id}`,
        method: "PUT",
        body: {
          status,
          ...(forceConfirmedRejection ? { forceConfirmedRejection: true } : {}),
          ...(confirmationToken ? { confirmationToken } : {}),
        },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Transactions", id },
        "Transactions",
      ],
    }),

    issueQuotation: builder.mutation({
      query: ({
        id,
        quotationItems,
      }: {
        id: string;
        quotationItems: Array<{
          orderItemId: string;
          quantity: number;
          price: number;
        }>;
      }) => ({
        url: `/transactions/quotation/${id}`,
        method: "PUT",
        body: {
          quotationItems,
        },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Transactions", id },
        "Transactions",
        "Order",
      ],
    }),

    deleteTransaction: builder.mutation({
      query: (id) => ({
        url: `/transactions/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, id) => [
        { type: "Transactions", id },
        "Transactions",
      ],
    }),
  }),
});

export const {
  useGetAllTransactionsQuery,
  useGetTransactionQuery,
  useUpdateTransactionStatusMutation,
  useIssueQuotationMutation,
  useDeleteTransactionMutation,
} = transactionApi;
