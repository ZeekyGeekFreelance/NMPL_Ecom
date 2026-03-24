"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import Input from "@/app/components/atoms/Input";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import MainLayout from "@/app/components/templates/MainLayout";
import { Loader2 } from "lucide-react";
import { useSignInMutation } from "@/app/store/apis/AuthApi";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";
import GuestOnlyGuard from "@/app/components/auth/GuestOnlyGuard";
import { runtimeEnv } from "@/app/lib/runtimeEnv";
import { resolveDisplayRole } from "@/app/lib/userRole";
import { storeFirstLoginState } from "@/app/lib/firstLoginPasswordFlow";
import { consumeAuthFlashMessage } from "@/app/lib/authSessionRecovery";
import {
  normalizeEmailValue,
  validateEmailValue,
} from "@/app/lib/validators/common";

interface InputForm {
  email: string;
  password: string;
}

const SignIn = () => {
  const [signIn, { error, isLoading }] = useSignInMutation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const apiErrorMessage = getApiErrorMessage(error);
  const showDevCredentials = !runtimeEnv.isProduction;
  const [authFlashMessage, setAuthFlashMessage] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isValid },
  } = useForm<InputForm>({
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (formData: InputForm) => {
    try {
      const requestedNextPath = searchParams.get("next");
      const nextPath =
        requestedNextPath && requestedNextPath.startsWith("/")
          ? requestedNextPath
          : null;
      const response = await signIn({
        ...formData,
        email: normalizeEmailValue(formData.email),
        portal: "USER_PORTAL",
      }).unwrap();
      if (response.requiresPasswordChange) {
        storeFirstLoginState({
          email: normalizeEmailValue(formData.email),
          currentPassword: formData.password,
          portal: "USER_PORTAL",
          nextPath,
        });
        router.push("/change-password");
        return;
      }
      const role = resolveDisplayRole(response.user);
      const destination =
        role === "ADMIN" || role === "SUPERADMIN"
          ? "/dashboard"
          : role === "DEALER"
            ? nextPath || "/"
            : nextPath || "/";
      router.push(destination);
    } catch {
      // Mutation error state is already handled by RTK Query.
    }
  };

  useEffect(() => {
    setAuthFlashMessage(consumeAuthFlashMessage());
  }, []);

  return (
    <GuestOnlyGuard>
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
          <main className="w-full max-w-md bg-white rounded-lg shadow-lg p-6 sm:p-8">
            <h2 className="type-h2 text-gray-800 text-center mb-6">
              Sign In
            </h2>
            <div className="text-center text-sm mb-4 space-y-1">
              <div className="text-gray-600">
                Dealer account?
                <Link href="/dealer/sign-in" className="ml-1 font-medium hover:underline" style={{ color: 'var(--color-primary)' }}>
                  Sign in as Dealer
                </Link>
              </div>
              <div className="text-gray-600">
                New dealer request?
                <Link href="/dealer/register" className="ml-1 font-medium hover:underline" style={{ color: 'var(--color-secondary)' }}>
                  Register as Dealer
                </Link>
              </div>
            </div>

            {showDevCredentials && (
              <div className="mb-4 rounded-md p-3 text-xs" style={{ border: '1px solid var(--color-primary-muted)', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                <p className="font-semibold">Test login hints</p>
                <p>Super Admin: superadmin@example.com / password123</p>
                <p>Admin: admin@example.com / password123</p>
                <p>User: user@example.com / password123</p>
              </div>
            )}

            {authFlashMessage && !error && (
              <div className="bg-amber-50 border border-amber-300 text-amber-700 text-center text-sm p-3 rounded mb-4">
                {authFlashMessage}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-300 text-red-600 text-center text-sm p-3 rounded mb-4">
                {apiErrorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                name="email"
                type="email"
                placeholder="Email"
                control={control}
                validation={{
                  required: "Email is required",
                  validate: (value: string) => validateEmailValue(value),
                }}
                onChange={(event) => {
                  setValue("email", normalizeEmailValue(event.target.value), {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                }}
                error={errors.email?.message}
                className="py-2.5 text-sm"
              />

              <Input
                name="password"
                type="password"
                placeholder="Password"
                control={control}
                validation={{
                  required: "Password is required",
                  minLength: {
                    value: 6,
                    message: "Password must be at least 6 characters long",
                  },
                }}
                error={errors.password?.message}
                className="py-2.5 text-sm"
              />

              <div className="-mt-1 text-left">
                <Link href="/password-reset" className="text-xs hover:underline" style={{ color: 'var(--color-primary)' }}>
                  Forgot Password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={isLoading || !isValid}
                className="btn-primary w-full"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin mx-auto" size={20} />
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <div className="text-center text-sm text-gray-600 mt-4">
              Don&apos;t have an account?{" "}
              <Link href="/sign-up" className="font-medium hover:underline" style={{ color: 'var(--color-primary)' }}>
                Sign up
              </Link>
            </div>


          </main>
        </div>
      </MainLayout>
    </GuestOnlyGuard>
  );
};

export default SignIn;
