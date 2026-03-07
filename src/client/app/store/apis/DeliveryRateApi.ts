import { apiSlice } from "../slices/ApiSlice";

export interface StateDeliveryRate {
  id: string;
  state: string;
  charge: number;
  isServiceable: boolean;
  createdAt: string;
  updatedAt: string;
}

export const deliveryRateApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getStateDeliveryRates: builder.query<{ rates: StateDeliveryRate[] }, void>({
      query: () => ({
        url: "/delivery-rates/states",
        method: "GET",
      }),
      providesTags: ["DeliveryRate"],
    }),
    upsertStateDeliveryRate: builder.mutation<
      { rate: StateDeliveryRate },
      { state: string; charge: number; isServiceable: boolean }
    >({
      query: ({ state, charge, isServiceable }) => ({
        url: `/delivery-rates/states/${encodeURIComponent(state)}`,
        method: "PUT",
        body: {
          charge,
          isServiceable,
        },
      }),
      invalidatesTags: ["DeliveryRate"],
    }),
    deleteStateDeliveryRate: builder.mutation<{ message: string }, { state: string }>({
      query: ({ state }) => ({
        url: `/delivery-rates/states/${encodeURIComponent(state)}`,
        method: "DELETE",
      }),
      invalidatesTags: ["DeliveryRate"],
    }),
  }),
});

export const {
  useGetStateDeliveryRatesQuery,
  useUpsertStateDeliveryRateMutation,
  useDeleteStateDeliveryRateMutation,
} = deliveryRateApi;
