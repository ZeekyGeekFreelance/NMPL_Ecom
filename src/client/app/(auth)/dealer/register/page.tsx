"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import Input from "@/app/components/atoms/Input";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import MainLayout from "@/app/components/templates/MainLayout";
import {
  useRequestRegistrationOtpMutation,
  useSignupMutation,
} from "@/app/store/apis/AuthApi";
import GuestOnlyGuard from "@/app/components/auth/GuestOnlyGuard";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";

interface DealerRegisterForm {
  name: string;
  email: string;
  password: string;
  otpCode: string;
  businessName: string;
  contactPhone: string;
}

const DealerRegister = () => {
  const [signup, { isLoading, error }] = useSignupMutation();
  const [requestRegistrationOtp, { isLoading: isSendingOtp }] =
    useRequestRegistrationOtpMutation();
  const [successMessage, setSuccessMessage] = useState("");
  const [otpMessage, setOtpMessage] = useState("");
  const apiErrorMessage = getApiErrorMessage(
    error,
    "Failed to submit dealer registration."
  );

  const {
    control,
    getValues,
    setError,
    clearErrors,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DealerRegisterForm>({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      otpCode: "",
      businessName: "",
      contactPhone: "",
    },
  });

  const handleSendOtp = async () => {
    const email = getValues("email")?.trim();
    if (!email) {
      setError("email", { message: "Email is required before requesting OTP." });
      return;
    }

    clearErrors("email");

    try {
      const response = await requestRegistrationOtp({
        email,
        purpose: "DEALER_PORTAL",
        requestDealerAccess: true,
      }).unwrap();

      setOtpMessage(response.message || "Verification OTP sent to your email.");
    } catch (otpError) {
      setOtpMessage(getApiErrorMessage(otpError as any, "Failed to send OTP"));
    }
  };

  const onSubmit = async (formData: DealerRegisterForm) => {
    try {
      await signup({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        otpCode: formData.otpCode,
        requestDealerAccess: true,
        businessName: formData.businessName,
        contactPhone: formData.contactPhone,
      }).unwrap();

      setSuccessMessage(
        "Dealer request submitted. An admin will approve your account before you can sign in."
      );
      reset();
    } catch {
      // Error handled by mutation state.
    }
  };

  return (
    <GuestOnlyGuard>
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
          <main className="w-full max-w-md bg-white rounded-lg shadow-lg p-6 sm:p-8">
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 text-center mb-2">
              Dealer Registration
            </h2>
            <p className="text-sm text-gray-600 text-center mb-6">
              Submit your business details. Admin approval is required for dealer pricing access.
            </p>

            {successMessage && (
              <div className="bg-green-50 border border-green-300 text-green-700 text-center text-sm p-3 rounded mb-4">
                {successMessage}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-300 text-red-600 text-center text-sm p-3 rounded mb-4">
                {apiErrorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                name="name"
                type="text"
                placeholder="Contact person name"
                control={control}
                validation={{
                  required: "Name is required",
                  minLength: {
                    value: 3,
                    message: "Name must be at least 3 characters long",
                  },
                }}
                error={errors.name?.message}
                className="py-2.5 text-sm"
              />

              <Input
                name="email"
                type="text"
                placeholder="Business email"
                control={control}
                validation={{
                  required: "Email is required",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Enter a valid email",
                  },
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
                    value: 8,
                    message: "Password must be at least 8 characters long",
                  },
                  validate: {
                    hasUppercase: (value) =>
                      /[A-Z]/.test(value) ||
                      "Password must contain at least one uppercase letter",
                    hasLowercase: (value) =>
                      /[a-z]/.test(value) ||
                      "Password must contain at least one lowercase letter",
                    hasNumber: (value) =>
                      /[0-9]/.test(value) ||
                      "Password must contain at least one number",
                    hasSpecialChar: (value) =>
                      /[!@#$%^&*]/.test(value) ||
                      "Password must contain at least one special character (!@#$%^&*)",
                  },
                }}
                error={errors.password?.message}
                className="py-2.5 text-sm"
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSendOtp}
                  className="text-xs sm:text-sm px-3 py-1.5 rounded-md border border-indigo-300 text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                  disabled={isSendingOtp}
                >
                  {isSendingOtp ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 size={14} className="animate-spin" />
                      Sending OTP...
                    </span>
                  ) : (
                    "Send Email OTP"
                  )}
                </button>
              </div>

              {otpMessage && (
                <p className="text-xs sm:text-sm text-gray-600">{otpMessage}</p>
              )}

              <Input
                name="otpCode"
                type="text"
                placeholder="6-digit OTP"
                control={control}
                validation={{
                  required: "OTP is required",
                  pattern: {
                    value: /^\d{6}$/,
                    message: "Enter a valid 6-digit OTP",
                  },
                }}
                error={errors.otpCode?.message}
                className="py-2.5 text-sm"
              />

              <Input
                name="businessName"
                type="text"
                placeholder="Business name"
                control={control}
                validation={{ required: "Business name is required" }}
                error={errors.businessName?.message}
                className="py-2.5 text-sm"
              />

              <Input
                name="contactPhone"
                type="text"
                placeholder="Contact phone"
                control={control}
                validation={{ required: "Contact phone is required" }}
                error={errors.contactPhone?.message}
                className="py-2.5 text-sm"
              />

              <button
                type="submit"
                className={`w-full py-2.5 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 transition-colors ${
                  isLoading ? "cursor-not-allowed bg-gray-400" : ""
                }`}
              >
                {isLoading ? (
                  <Loader2 className="animate-spin mx-auto" size={20} />
                ) : (
                  "Submit Dealer Request"
                )}
              </button>
            </form>

            <div className="text-center text-sm text-gray-600 mt-4">
              Already approved?{" "}
              <Link href="/dealer/sign-in" className="text-indigo-600 hover:underline">
                Dealer sign in
              </Link>
            </div>
            <div className="text-center text-sm text-gray-600 mt-2">
              <Link href="/sign-in" className="text-indigo-600 hover:underline">
                Back to sign in
              </Link>
            </div>
          </main>
        </div>
      </MainLayout>
    </GuestOnlyGuard>
  );
};

export default DealerRegister;
