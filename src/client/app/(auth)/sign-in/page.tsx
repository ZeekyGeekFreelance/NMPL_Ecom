"use client";

import { useForm } from "react-hook-form";
import Input from "@/app/components/atoms/Input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MainLayout from "@/app/components/templates/MainLayout";
import { Loader2 } from "lucide-react";
import { useSignInMutation } from "@/app/store/apis/AuthApi";
import GoogleIcon from "@/app/assets/icons/google.png";
import FacebookIcon from "@/app/assets/icons/facebook.png";
import TwitterIcon from "@/app/assets/icons/twitter.png";
import Image from "next/image";
import { AUTH_API_BASE_URL } from "@/app/lib/constants/config";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";
import GuestOnlyGuard from "@/app/components/auth/GuestOnlyGuard";

interface InputForm {
  email: string;
  password: string;
}

const SignIn = () => {
  const [signIn, { error, isLoading }] = useSignInMutation();
  const router = useRouter();
  const apiErrorMessage = getApiErrorMessage(error);
  const showDevCredentials = process.env.NODE_ENV !== "production";

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<InputForm>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (formData: InputForm) => {
    try {
      const response = await signIn(formData).unwrap();
      const destination =
        response.user?.role === "ADMIN" || response.user?.role === "SUPERADMIN"
          ? "/dashboard"
          : "/";
      router.push(destination);
    } catch {
      // Mutation error state is already handled by RTK Query.
    }
  };

  const handleOAuthLogin = (provider: string) => {
    window.location.href = `${AUTH_API_BASE_URL}/auth/${provider}`;
  };

  return (
    <GuestOnlyGuard>
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
          <main className="w-full max-w-md bg-white rounded-lg shadow-lg p-6 sm:p-8">
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 text-center mb-6">
              Sign In
            </h2>
            <div className="text-center text-sm mb-4 space-y-1">
              <div className="text-gray-600">
                Dealer account?
                <Link href="/dealer/sign-in" className="ml-1 text-indigo-600 hover:underline">
                  Sign in as Dealer
                </Link>
              </div>
              <div className="text-gray-600">
                New dealer request?
                <Link href="/dealer/register" className="ml-1 text-indigo-600 hover:underline">
                  Register as Dealer
                </Link>
              </div>
            </div>

            {showDevCredentials && (
              <div className="mb-4 rounded-md border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900">
                <p className="font-semibold">Test login hints</p>
                <p>Super Admin: superadmin@example.com / password123</p>
                <p>Admin: admin@example.com / password123</p>
                <p>User: user@example.com / password123</p>
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
                type="text"
                placeholder="Email"
                control={control}
                validation={{ required: "Email is required" }}
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

              <Link
                href="/password-reset"
                className="block text-sm text-indigo-600 hover:underline mb-4"
              >
                Forgot password?
              </Link>

              <button
                type="submit"
                className={`w-full py-2.5 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 transition-colors ${
                  isLoading ? "cursor-not-allowed bg-gray-400" : ""
                }`}
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
              <Link href="/sign-up" className="text-indigo-600 hover:underline">
                Sign up
              </Link>
            </div>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or</span>
              </div>
            </div>

            <div className="space-y-2">
              {[
                {
                  provider: "google",
                  icon: GoogleIcon,
                  label: "Sign in with Google",
                },
                {
                  provider: "facebook",
                  icon: FacebookIcon,
                  label: "Sign in with Facebook",
                },
                {
                  provider: "twitter",
                  icon: TwitterIcon,
                  label: "Sign in with X",
                },
              ].map(({ provider, icon, label }) => (
                <button
                  key={provider}
                  onClick={() => handleOAuthLogin(provider)}
                  className="w-full py-3 border-2 border-gray-100 bg-transparent text-black rounded-md font-medium hover:bg-gray-50
                   transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Image width={20} height={20} src={icon} alt={provider} />
                  {label}
                </button>
              ))}
            </div>
          </main>
        </div>
      </MainLayout>
    </GuestOnlyGuard>
  );
};

export default SignIn;

