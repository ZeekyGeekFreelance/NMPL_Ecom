import { apiSlice } from "../slices/ApiSlice";
import { setUser, logout } from "../slices/AuthSlice";
import { emitAuthSyncEvent } from "@/app/lib/authSyncChannel";
import { clearPendingAuthIntent } from "@/app/lib/authIntent";

interface User {
  id: string;
  accountReference?: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  effectiveRole?: "USER" | "DEALER" | "ADMIN" | "SUPERADMIN";
  avatar: string | null;
  isDealer?: boolean;
  dealerStatus?:
    | "PENDING"
    | "APPROVED"
    | "LEGACY"
    | "REJECTED"
    | "SUSPENDED"
    | null;
  dealerBusinessName?: string | null;
  dealerContactPhone?: string | null;
}

export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    requestRegistrationOtp: builder.mutation<
      { message: string; resendAvailableInSeconds?: number },
      {
        email: string;
        phone: string;
        purpose?: "USER_PORTAL" | "DEALER_PORTAL";
        requestDealerAccess?: boolean;
      }
    >({
      query: (payload) => ({
        url: "/auth/request-registration-otp",
        method: "POST",
        body: payload,
      }),
    }),
    signIn: builder.mutation<
      { message: string; user: User; requiresPasswordChange?: boolean },
      {
        email: string;
        password: string;
        portal?: "USER_PORTAL" | "DEALER_PORTAL";
      }
    >({
      query: (credentials) => ({
        url: "/auth/sign-in",
        method: "POST",
        body: credentials,
      }),
      onQueryStarted: async (_, { dispatch, queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          // Only set user if password change is NOT required
          if (!(data as any).requiresPasswordChange) {
            dispatch(setUser({ user: data.user }));
          }
        } catch {
          // Ignore mutation rejection here; components already consume error state.
        }
      },
    }),
    signup: builder.mutation<
      { message: string; user: User; requiresApproval?: boolean },
      {
        name: string;
        email: string;
        phone: string;
        password: string;
        emailOtpCode: string;
        phoneOtpCode?: string;
        requestDealerAccess?: boolean;
        businessName?: string;
        contactPhone?: string;
      }
    >({
      query: (data) => ({
        url: "/auth/sign-up",
        method: "POST",
        body: data,
      }),
      onQueryStarted: async (_, { dispatch, queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          if (!data.requiresApproval) {
            dispatch(setUser({ user: data.user }));
          }
        } catch {
          // Ignore mutation rejection here; components already consume error state.
        }
      },
    }),
    applyDealerAccess: builder.mutation<
      { message: string; user: User; requiresApproval?: boolean },
      { businessName?: string; contactPhone?: string }
    >({
      query: (data) => ({
        url: "/auth/dealer/apply",
        method: "POST",
        body: data,
      }),
      onQueryStarted: async (_, { dispatch, queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          dispatch(setUser({ user: data.user }));
        } catch {
          // Ignore mutation rejection here; components already consume error state.
        }
      },
    }),
    signOut: builder.mutation<void, void>({
      query: () => ({
        url: "/auth/sign-out",
        method: "GET",
      }),
      onQueryStarted: async (_, { dispatch, queryFulfilled }) => {
        try {
          await queryFulfilled;
        } finally {
          dispatch(apiSlice.util.resetApiState());
          dispatch(logout());
          clearPendingAuthIntent();
          emitAuthSyncEvent("SIGNED_OUT");
        }
      },
    }),
    forgotPassword: builder.mutation<{ message?: string }, { email: string }>({
      query: ({ email }) => ({
        url: "/auth/forgot-password",
        method: "POST",
        body: { email },
      }),
    }),
    resetPassword: builder.mutation<
      { message?: string },
      { token: string; newPassword: string }
    >({
      query: ({ token, newPassword }) => ({
        url: "/auth/reset-password",
        method: "POST",
        body: { token, newPassword },
      }),
    }),
    checkAuth: builder.mutation<
      { message: string; accessToken: string; user: User },
      void
    >({
      query: () => ({
        url: "/auth/refresh-token",
        method: "POST",
      }),
      onQueryStarted: async (_, { dispatch, queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          dispatch(setUser({ user: data.user }));
          emitAuthSyncEvent("SESSION_REFRESHED");
        } catch {
          // Ignore refresh failures here to avoid noisy unhandled rejections.
        }
      },
    }),
  }),
});

export const {
  useRequestRegistrationOtpMutation,
  useSignInMutation,
  useSignupMutation,
  useApplyDealerAccessMutation,
  useSignOutMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useCheckAuthMutation,
} = authApi;
