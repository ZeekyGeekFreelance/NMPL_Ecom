import { apiSlice } from "../slices/ApiSlice";

export interface DealerProfile {
  id?: string;
  businessName?: string | null;
  contactPhone?: string | null;
  status?: "PENDING" | "APPROVED" | "LEGACY" | "REJECTED" | "SUSPENDED" | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  /** Phase-2 pay-later fields */
  payLaterEnabled?: boolean | null;
  creditTermDays?: number | null;
}

export const userApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ── Self ────────────────────────────────────────────────────────────────

    /** GET /users/me — returns { user } */
    getMe: builder.query<{ user: any }, void>({
      query: () => "/users/me",
      providesTags: ["User"],
    }),

    /** PATCH /users/me — update own display name + phone */
    updateMyProfile: builder.mutation<
      { user: any },
      { name?: string; phone?: string }
    >({
      query: (body) => ({
        url: "/users/me",
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["User"],
    }),

    // ── Admin: fetch any user by ID ─────────────────────────────────────────

    /**
     * GET /users/:id — ADMIN + SUPERADMIN.
     * Used by CreditLedgerModal to load dealer display info.
     */
    getUserById: builder.query<{ user: any }, string>({
      query: (userId) => `/users/${userId}`,
      providesTags: (result, error, id) => [{ type: "User", id }],
    }),

    // ── Dealers ─────────────────────────────────────────────────────────────

    /**
     * GET /users/dealers[?status=...]
     * Pass undefined/void for all dealers, or { status } to filter server-side.
     */
    getDealers: builder.query<
      { dealers: any[] },
      { status?: string } | undefined
    >({
      query: (params) => ({
        url: "/users/dealers",
        params: params?.status ? { status: params.status } : undefined,
      }),
      providesTags: ["Dealers"],
    }),

    /** POST /users/dealers */
    createDealer: builder.mutation<
      { dealer: any },
      {
        name: string;
        email: string;
        password: string;
        businessName: string;
        contactPhone: string;
        /**
         * When true: status=LEGACY, payLaterEnabled=true, mustChangePassword=true.
         * Omit (or false) for a standard APPROVED dealer.
         */
        isLegacy?: boolean;
      }
    >({
      query: (body) => ({
        url: "/users/dealers",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Dealers"],
    }),

    /** PATCH /users/dealers/:id/status */
    updateDealerStatus: builder.mutation<
      { dealer: any },
      { id: string; status: string }
    >({
      query: ({ id, status }) => ({
        url: `/users/dealers/${id}/status`,
        method: "PATCH",
        body: { status },
      }),
      invalidatesTags: ["Dealers"],
    }),

    /** DELETE /users/dealers/:id */
    deleteDealer: builder.mutation<{ message: string }, string>({
      query: (dealerId) => ({
        url: `/users/dealers/${dealerId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Dealers"],
    }),

    /** GET /users/dealers/:id/prices */
    getDealerPrices: builder.query<
      { prices: Array<{ variantId: string; customPrice: number }> },
      string
    >({
      query: (dealerId) => `/users/dealers/${dealerId}/prices`,
      providesTags: (result, error, id) => [{ type: "DealerPrices", id }],
    }),

    /** PUT /users/dealers/:id/prices */
    setDealerPrices: builder.mutation<
      { message: string },
      {
        dealerId: string;
        prices: Array<{ variantId: string; customPrice: number }>;
      }
    >({
      query: ({ dealerId, prices }) => ({
        url: `/users/dealers/${dealerId}/prices`,
        method: "PUT",
        body: { prices },
      }),
      invalidatesTags: (result, error, { dealerId }) => [
        { type: "DealerPrices", id: dealerId },
      ],
    }),

    // ── Admin: User Management ──────────────────────────────────────────────

    /** GET /users — SUPERADMIN only */
    getAllUsers: builder.query<{ users: any[] }, void>({
      query: () => "/users",
      providesTags: ["User"],
    }),

    /** PATCH /users/:id — SUPERADMIN only */
    updateUser: builder.mutation<
      { user: any },
      { id: string; data: { role?: string } }
    >({
      query: ({ id, data }) => ({
        url: `/users/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["User"],
    }),

    /** DELETE /users/:id — SUPERADMIN only */
    deleteUser: builder.mutation<{ message: string }, string | number>({
      query: (userId) => ({
        url: `/users/${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["User"],
    }),

    /** PATCH /users/:id/billing-supervisor — SUPERADMIN only */
    updateBillingSupervisor: builder.mutation<
      { user: any },
      { id: string; isBillingSupervisor: boolean }
    >({
      query: ({ id, isBillingSupervisor }) => ({
        url: `/users/${id}/billing-supervisor`,
        method: "PATCH",
        body: { isBillingSupervisor },
      }),
      invalidatesTags: ["User"],
    }),

    /** PATCH /users/:id/admin-password — SUPERADMIN only */
    updateAdminPassword: builder.mutation<
      { message: string },
      { id: string; newPassword: string }
    >({
      query: ({ id, newPassword }) => ({
        url: `/users/${id}/admin-password`,
        method: "PATCH",
        body: { newPassword },
      }),
      invalidatesTags: ["User"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetMeQuery,
  useLazyGetMeQuery,
  useUpdateMyProfileMutation,
  useGetUserByIdQuery,
  useGetDealersQuery,
  useCreateDealerMutation,
  useUpdateDealerStatusMutation,
  useDeleteDealerMutation,
  useGetDealerPricesQuery,
  useSetDealerPricesMutation,
  useGetAllUsersQuery,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useUpdateBillingSupervisorMutation,
  useUpdateAdminPasswordMutation,
} = userApi;

/**
 * Alias — CreditLedgerModal imports useGetProfileQuery to load a dealer's
 * display info.  It maps to the same GET /users/:id endpoint.
 */
export const useGetProfileQuery = userApi.endpoints.getUserById.useQuery;
