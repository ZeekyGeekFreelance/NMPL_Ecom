import { apiSlice } from "../slices/ApiSlice";
import { setUser, logout } from "../slices/AuthSlice";
import { emitAuthSyncEvent } from "@/app/lib/authSyncChannel";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  avatar: string | null;
}

export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    requestRegistrationOtp: builder.mutation<
      { message: string },
      {
        email: string;
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
      { accessToken: string; user: User },
      { email: string; password: string }
    >({
      query: (credentials) => ({
        url: "/auth/sign-in",
        method: "POST",
        body: credentials,
      }),
      onQueryStarted: async (_, { dispatch, queryFulfilled }) => {
        const { data } = await queryFulfilled;
        // Backend returns { success, message, user }
        dispatch(setUser({ user: data.user }));
      },
    }),
    signup: builder.mutation<
      { accessToken: string; user: User },
      {
        name: string;
        email: string;
        password: string;
        otpCode?: string;
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
        const { data } = await queryFulfilled;
        // Backend returns { success, message, user }
        dispatch(setUser({ user: data.user }));
      },
    }),
    signOut: builder.mutation<void, void>({
      query: () => ({
        url: "/auth/sign-out",
        method: "GET",
      }),
      onQueryStarted: async (_, { dispatch, queryFulfilled }) => {
        await queryFulfilled;
        dispatch(logout());
      },
    }),
    forgotPassword: builder.mutation<void, { email: string }>({
      query: ({ email }) => ({
        url: "/auth/forgot-password",
        method: "POST",
        body: { email },
      }),
    }),
    resetPassword: builder.mutation<void, { token: string; password: string }>({
      query: ({ token, password }) => ({
        url: "/auth/reset-password",
        method: "POST",
        body: { token, password },
      }),
    }),
    checkAuth: builder.mutation<{ accessToken: string; user: User }, void>({
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
  useSignOutMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useCheckAuthMutation,
} = authApi;
