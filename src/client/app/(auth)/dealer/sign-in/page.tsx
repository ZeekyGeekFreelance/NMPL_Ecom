"use client";

import { useForm } from "react-hook-form";
import Input from "@/app/components/atoms/Input";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import MainLayout from "@/app/components/templates/MainLayout";
import { Loader2 } from "lucide-react";
import { useSignInMutation } from "@/app/store/apis/AuthApi";
import GuestOnlyGuard from "@/app/components/auth/GuestOnlyGuard";
import { resolveDisplayRole } from "@/app/lib/userRole";
import {
  normalizeEmailValue,
  validateEmailValue,
} from "@/app/lib/validators/common";

interface InputForm {
  email: string;
  password: string;
}

const DealerSignIn = () => {
  const [signIn, { error, isLoading }] = useSignInMutation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const apiErrorMessage =
    (error as any)?.data?.message || "Unable to sign in with dealer credentials.";

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
      const response = await signIn({
        ...formData,
        email: normalizeEmailValue(formData.email),
        portal: "DEALER_PORTAL",
      }).unwrap();
      const requestedNextPath = searchParams.get("next");
      const nextPath =
        requestedNextPath && requestedNextPath.startsWith("/")
          ? requestedNextPath
          : null;
      const role = resolveDisplayRole(response.user);
      const destination =
        role === "ADMIN" || role === "SUPERADMIN"
          ? "/dashboard"
          : role === "DEALER"
            ? nextPath || "/"
            : nextPath || "/";
      router.push(destination);
    } catch {
      // Error handled from mutation state.
    }
  };

  return (
    <GuestOnlyGuard>
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
          <main className="w-full max-w-md bg-white rounded-lg shadow-lg p-6 sm:p-8">
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 text-center mb-2">
              Dealer Sign In
            </h2>
            <p className="text-sm text-gray-600 text-center mb-6">
              Use your approved dealer account to access dealer-specific pricing.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-300 text-red-600 text-center text-sm p-3 rounded mb-4">
                {apiErrorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                name="email"
                type="email"
                placeholder="Dealer email"
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
                <Link
                  href="/password-reset"
                  className="text-xs hover:underline"
                  style={{ color: "var(--color-primary)" }}
                >
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
                  "Sign In as Dealer"
                )}
              </button>
            </form>

            <div className="text-center text-sm text-gray-600 mt-4">
              Not approved yet?{" "}
              <Link
                href="/dealer/register"
                className="hover:underline"
                style={{ color: "var(--color-primary)" }}
              >
                Request dealer access
              </Link>
            </div>
            <div className="text-center text-sm text-gray-600 mt-2">
              <Link
                href="/sign-in"
                className="hover:underline"
                style={{ color: "var(--color-primary)" }}
              >
                Back to customer/admin sign in
              </Link>
            </div>
          </main>
        </div>
      </MainLayout>
    </GuestOnlyGuard>
  );
};

export default DealerSignIn;
