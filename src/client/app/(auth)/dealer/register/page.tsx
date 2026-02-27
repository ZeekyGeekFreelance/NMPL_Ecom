"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import Input from "@/app/components/atoms/Input";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import MainLayout from "@/app/components/templates/MainLayout";
import { useSignupMutation } from "@/app/store/apis/AuthApi";
import GuestOnlyGuard from "@/app/components/auth/GuestOnlyGuard";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";
import PasswordField from "@/app/components/molecules/PasswordField";
import { z } from "zod";
import { useRegistrationOtp } from "../../shared/useRegistrationOtp";

interface DealerRegisterForm {
  name: string;
  email: string;
  contactPhone: string;
  password: string;
  emailOtpCode: string;
  businessName: string;
}

const DealerRegister = () => {
  const [signup, { isLoading, error }] = useSignupMutation();
  const [successMessage, setSuccessMessage] = useState("");
  const apiErrorMessage = getApiErrorMessage(
    error,
    "Failed to submit dealer registration."
  );
  const {
    sendOtp,
    isSendingOtp,
    cooldownSeconds,
    feedback: otpFeedback,
    canSendOtp,
  } = useRegistrationOtp({
    purpose: "DEALER_PORTAL",
    requestDealerAccess: true,
  });

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

  const phoneSchema = (value: string) => {
    const result = z
      .string()
      .trim()
      .regex(
        /^[0-9()+\-\s]{7,20}$/,
        "Phone number must be 7-20 characters and contain only valid digits/symbols"
      )
      .safeParse(value);
    return result.success || result.error.errors[0].message;
  };

  const {
    control,
    register,
    watch,
    getValues,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DealerRegisterForm>({
    defaultValues: {
      name: "",
      email: "",
      contactPhone: "",
      password: "",
      emailOtpCode: "",
      businessName: "",
    },
  });

  const handleSendOtp = async () => {
    await sendOtp(getValues("email"), getValues("contactPhone"));
  };

  const onSubmit = async (formData: DealerRegisterForm) => {
    try {
      await signup({
        name: formData.name,
        email: formData.email,
        phone: formData.contactPhone,
        password: formData.password,
        emailOtpCode: formData.emailOtpCode,
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
                  validate: nameSchema,
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
                  validate: emailSchema,
                }}
                error={errors.email?.message}
                className="py-2.5 text-sm"
              />

              <Input
                name="contactPhone"
                type="text"
                placeholder="Contact phone"
                control={control}
                validation={{
                  required: "Contact phone is required",
                  validate: phoneSchema,
                }}
                error={errors.contactPhone?.message}
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

              <PasswordField register={register} watch={watch} errors={errors} />

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Verify email</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Request OTP and enter the 6-digit email code to submit dealer access.
                  </p>
                </div>

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
                  name="emailOtpCode"
                  type="text"
                  placeholder="Email OTP"
                  control={control}
                  validation={{
                    required: "Email OTP is required",
                    pattern: {
                      value: /^\d{6}$/,
                      message: "Email OTP must be a valid 6-digit code",
                    },
                  }}
                  error={errors.emailOtpCode?.message}
                  className="py-2.5 text-sm"
                />
              </div>

              <button
                type="submit"
                className={`btn-primary w-full ${
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
