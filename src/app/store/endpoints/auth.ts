import { apiSlice } from "../api.slice";

export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    signIn: builder.mutation<any, { email: string; password: string }>({
      query: (body) => ({ url: "/auth/sign-in", method: "POST", body }),
    }),
    signOut: builder.mutation<any, void>({
      query: () => ({ url: "/auth/sign-out", method: "POST" }),
    }),
    signUp: builder.mutation<any, any>({
      query: (body) => ({ url: "/auth/sign-up", method: "POST", body }),
    }),
    forgotPassword: builder.mutation<any, { email: string }>({
      query: (body) => ({ url: "/auth/forgot-password", method: "POST", body }),
    }),
    resetPassword: builder.mutation<any, { token: string; password: string }>({
      query: ({ token, password }) => ({ url: `/auth/reset-password/${token}`, method: "POST", body: { password } }),
    }),
    changePassword: builder.mutation<any, { currentPassword: string; newPassword: string }>({
      query: (body) => ({ url: "/auth/change-password", method: "POST", body }),
    }),
    getMe: builder.query<any, void>({
      query: () => "/users/me",
      providesTags: ["Users"],
    }),
    registerDealer: builder.mutation<any, any>({
      query: (body) => ({ url: "/auth/dealer/register", method: "POST", body }),
    }),
  }),
});

export const {
  useSignInMutation,
  useSignOutMutation,
  useSignUpMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useChangePasswordMutation,
  useGetMeQuery,
  useRegisterDealerMutation,
} = authApi;
