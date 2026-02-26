"use client";
import { useForm } from "react-hook-form";
import Input from "@/app/components/atoms/Input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import PasswordField from "@/app/components/molecules/PasswordField";
import { z } from "zod";
import MainLayout from "@/app/components/templates/MainLayout";
import {
  useSignupMutation,
} from "@/app/store/apis/AuthApi";
import GoogleIcon from "@/app/assets/icons/google.png";
import FacebookIcon from "@/app/assets/icons/facebook.png";
import TwitterIcon from "@/app/assets/icons/twitter.png";
import Image from "next/image";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";
import GuestOnlyGuard from "@/app/components/auth/GuestOnlyGuard";
import { AUTH_API_BASE_URL } from "@/app/lib/constants/config";
import { useRegistrationOtp } from "../shared/useRegistrationOtp";

interface InputForm {
  name: string;
  email: string;
  password: string;
  otpCode: string;
}

const nameSchema = (value: string) => {
  const result = z
    .string()
    .min(2, "Name must be at least 2 characters long")
    .safeParse(value);
  return result.success || result.error.errors[0].message;
};

const emailSchema = (value: string) => {
  const result = z.string().email("Invalid email address").safeParse(value);
  return result.success || result.error.errors[0].message;
};

const Signup = () => {
  const [signUp, { isLoading, error }] = useSignupMutation();
  const {
    sendOtp,
    isSendingOtp,
    cooldownSeconds,
    feedback: otpFeedback,
    canSendOtp,
  } = useRegistrationOtp({
    purpose: "USER_PORTAL",
    requestDealerAccess: false,
  });
  const router = useRouter();
  const apiErrorMessage = getApiErrorMessage(
    error,
    "Signup failed. Please try again."
  );

  const {
    register,
    watch,
    getValues,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<InputForm>({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      otpCode: "",
    },
  });

  const onSubmit = async (formData: InputForm) => {
    try {
      await signUp(formData).unwrap();
      router.push("/");
    } catch {
      // Error is surfaced from mutation state.
    }
  };

  const handleOAuthLogin = (provider: string) => {
    window.location.href = `${AUTH_API_BASE_URL}/auth/${provider}`;
  };

  const handleSendOtp = async () => {
    const email = getValues("email");
    await sendOtp(email);
  };

  return (
    <GuestOnlyGuard>
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
          <main className="w-full max-w-md bg-white rounded-lg shadow-lg p-6 sm:p-8">
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 text-center mb-6">
              Sign Up
            </h2>

            {error && (
              <div className="bg-red-50 border border-red-300 text-red-600 text-center text-sm p-3 rounded mb-4">
                {apiErrorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                name="name"
                type="text"
                placeholder="Name"
                control={control}
                validation={{
                  required: "Name is required",
                  validate: nameSchema,
                }}
                error={errors.name?.message}
                className="py-2.5 text-sm"
              />

              <Input
                name="email"
                type="text"
                placeholder="Email"
                control={control}
                validation={{
                  required: "Email is required",
                  validate: emailSchema,
                }}
                error={errors.email?.message}
                className="py-2.5 text-sm"
              />

              <button
                type="button"
                onClick={handleSendOtp}
                disabled={!canSendOtp}
                className={`btn-base w-full border border-indigo-600 text-indigo-600 hover:bg-indigo-50 ${
                  !canSendOtp ? "cursor-not-allowed opacity-70" : ""
                }`}
              >
                {isSendingOtp
                  ? "Sending OTP..."
                  : cooldownSeconds > 0
                  ? `Resend OTP in ${cooldownSeconds}s`
                  : "Send OTP"}
              </button>

              {otpFeedback && (
                <p
                  className={`text-xs text-center ${
                    otpFeedback.type === "error" ? "text-red-600" : "text-gray-600"
                  }`}
                >
                  {otpFeedback.message}
                </p>
              )}

              <Input
                name="otpCode"
                type="text"
                placeholder="Enter OTP"
                control={control}
                validation={{
                  required: "OTP is required",
                  pattern: {
                    value: /^\d{6}$/,
                    message: "OTP must be a valid 6-digit code",
                  },
                }}
                error={errors.otpCode?.message}
                className="py-2.5 text-sm"
              />

              <PasswordField register={register} watch={watch} errors={errors} />

              <button
                type="submit"
                className={`btn-primary w-full ${
                  isLoading ? "cursor-not-allowed bg-gray-400" : ""
                }`}
              >
                {isLoading ? (
                  <Loader2 className="animate-spin mx-auto" size={20} />
                ) : (
                  "Create Account"
                )}
              </button>
            </form>

            <div className="text-center text-sm text-gray-600 mt-4">
              Already have an account?{" "}
              <Link href="/sign-in" className="text-indigo-600 hover:underline">
                Sign in
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
                  label: "Sign up with Google",
                },
                {
                  provider: "facebook",
                  icon: FacebookIcon,
                  label: "Sign up with Facebook",
                },
                {
                  provider: "twitter",
                  icon: TwitterIcon,
                  label: "Sign up with X",
                },
              ].map(({ provider, icon, label }) => (
                <button
                  key={provider}
                  onClick={() => handleOAuthLogin(provider)}
                  className="btn-base w-full border-2 border-gray-100 bg-transparent text-black hover:bg-gray-50"
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

export default Signup;
