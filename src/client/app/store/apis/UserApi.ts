import { User } from "@/app/types/authTypes";
import { apiSlice } from "../slices/ApiSlice";

interface DealerProfile {
  id: string;
  businessName: string | null;
  contactPhone: string | null;
  status: "PENDING" | "APPROVED" | "LEGACY" | "REJECTED" | "SUSPENDED";
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DealerUser {
  id: string;
  accountReference?: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
  dealerProfile: DealerProfile;
}

interface DealerPrice {
  variantId: string;
  customPrice: number;
  basePrice?: number;
  defaultDealerPrice?: number | null;
  sku: string;
  productName: string;
}

export const userApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAllUsers: builder.query({
      query: () => ({
        url: "/users",
      }),
      providesTags: ["User"],
    }),
    getAllAdmins: builder.query({
      query: () => ({
        url: "/users/admins",
      }),
      providesTags: ["User"],
    }),
    getProfile: builder.query({
      query: (id) => ({
        url: `/users/profile/${id}`,
        method: "GET",
      }),
      providesTags: ["User"],
    }),
    updateUser: builder.mutation({
      query: ({ id, data }) => ({
        url: `/users/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["User"],
    }),
    updateMyProfile: builder.mutation({
      query: (data: { name?: string; phone?: string }) => ({
        url: "/users/me",
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["User"],
    }),
    getMe: builder.query<User, void>({
      query: () => ({
        url: "/users/me",
        method: "GET",
      }),
      providesTags: ["User"],
    }),

    createAdmin: builder.mutation<
      { user: User },
      {
        name: string;
        email: string;
        phone: string;
        password: string;
        assignBillingSupervisor?: boolean;
      }
    >({
      query: (data) => ({
        url: "/users/admin",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["User"],
    }),
    updateBillingSupervisor: builder.mutation<
      { user: User },
      { id: string; isBillingSupervisor: boolean }
    >({
      query: ({ id, isBillingSupervisor }) => ({
        url: `/users/${id}/billing-supervisor`,
        method: "PATCH",
        body: { isBillingSupervisor },
      }),
      invalidatesTags: ["User"],
    }),
    updateAdminPassword: builder.mutation<
      { user: User },
      { id: string; newPassword: string }
    >({
      query: ({ id, newPassword }) => ({
        url: `/users/${id}/admin-password`,
        method: "PATCH",
        body: { newPassword },
      }),
      invalidatesTags: ["User"],
    }),

    deleteUser: builder.mutation({
      query: (id) => ({
        url: `/users/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["User"],
    }),
    getDealers: builder.query<{ dealers: DealerUser[] }, { status?: string } | void>({
      query: (params) => ({
        url: "/users/dealers",
        method: "GET",
        params: params || undefined,
      }),
      providesTags: ["User"],
    }),
    createDealer: builder.mutation<
      { dealer: DealerUser },
      {
        name: string;
        email: string;
        password: string;
        businessName?: string;
        contactPhone: string;
      }
    >({
      query: (data) => ({
        url: "/users/dealers",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["User"],
    }),
    updateDealerStatus: builder.mutation<
      { dealer: DealerUser },
      {
        id: string;
        status: "PENDING" | "APPROVED" | "LEGACY" | "REJECTED" | "SUSPENDED";
      }
    >({
      query: ({ id, status }) => ({
        url: `/users/dealers/${id}/status`,
        method: "PATCH",
        body: { status },
      }),
      invalidatesTags: ["User"],
    }),
    deleteDealer: builder.mutation<{ message: string }, string>({
      query: (dealerId) => ({
        url: `/users/dealers/${dealerId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["User", "Product", "Cart", "Order"],
    }),
    getDealerPrices: builder.query<{ prices: DealerPrice[] }, string>({
      query: (dealerId) => ({
        url: `/users/dealers/${dealerId}/prices`,
        method: "GET",
      }),
      providesTags: ["User"],
    }),
    setDealerPrices: builder.mutation<
      { prices: DealerPrice[] },
      { dealerId: string; prices: Array<{ variantId: string; customPrice: number }> }
    >({
      query: ({ dealerId, prices }) => ({
        url: `/users/dealers/${dealerId}/prices`,
        method: "PUT",
        body: { prices },
      }),
      invalidatesTags: ["User", "Product", "Cart", "Order"],
    }),
  }),
});

export const {
  useGetAllAdminsQuery,
  useUpdateUserMutation,
  useCreateAdminMutation,
  useUpdateBillingSupervisorMutation,
  useUpdateAdminPasswordMutation,
  useDeleteUserMutation,
  useGetProfileQuery,
  useGetMeQuery,
  useUpdateMyProfileMutation,
  useGetAllUsersQuery,
  useLazyGetMeQuery,
  useGetDealersQuery,
  useCreateDealerMutation,
  useUpdateDealerStatusMutation,
  useDeleteDealerMutation,
  useGetDealerPricesQuery,
  useSetDealerPricesMutation,
} = userApi;

