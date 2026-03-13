import { apiSlice } from "../slices/ApiSlice";

export type AddressType = "HOME" | "OFFICE" | "WAREHOUSE" | "OTHER";

export type Address = {
  id: string;
  userId: string;
  type: AddressType;
  fullName: string;
  phoneNumber: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  country: string;
  pincode: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateAddressPayload = {
  type?: AddressType;
  fullName: string;
  phoneNumber: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  isDefault?: boolean;
};

export type UpdateAddressPayload = Partial<CreateAddressPayload>;

export const addressApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAddresses: builder.query<{ addresses: Address[] }, void>({
      query: () => ({
        url: "/addresses",
        method: "GET",
        credentials: "include",
      }),
      providesTags: ["Address"],
    }),
    createAddress: builder.mutation<{ address: Address }, CreateAddressPayload>({
      query: (body) => ({
        url: "/addresses",
        method: "POST",
        body,
        credentials: "include",
      }),
      invalidatesTags: ["Address"],
    }),
    setDefaultAddress: builder.mutation<{ address: Address }, string>({
      query: (addressId) => ({
        url: `/addresses/${addressId}/default`,
        method: "PATCH",
        credentials: "include",
      }),
      invalidatesTags: ["Address"],
    }),
    updateAddress: builder.mutation<
      { address: Address },
      { addressId: string; body: UpdateAddressPayload }
    >({
      query: ({ addressId, body }) => ({
        url: `/addresses/${addressId}`,
        method: "PATCH",
        body,
        credentials: "include",
      }),
      invalidatesTags: ["Address"],
    }),
    deleteAddress: builder.mutation<{ message: string }, string>({
      query: (addressId) => ({
        url: `/addresses/${addressId}`,
        method: "DELETE",
        credentials: "include",
      }),
      invalidatesTags: ["Address"],
    }),
  }),
});

export const {
  useGetAddressesQuery,
  useCreateAddressMutation,
  useSetDefaultAddressMutation,
  useUpdateAddressMutation,
  useDeleteAddressMutation,
} = addressApi;
