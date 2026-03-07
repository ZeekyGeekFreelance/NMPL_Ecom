"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import Input from "@/app/components/atoms/Input";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import MainLayout from "@/app/components/templates/MainLayout";
import {
  useApplyDealerAccessMutation,
  useSignupMutation,
} from "@/app/store/apis/AuthApi";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";
import PasswordField from "@/app/components/molecules/PasswordField";
import { useRegistrationOtp } from "../../shared/useRegistrationOtp";
import {
  normalizeEmailValue,
  normalizePhoneDigits,
  sanitizeLooseTextInput,
  sanitizeTextInput,
  validateBusinessName,
  validateDisplayName,
  validateEmailValue,
  validateTenDigitPhone,
} from "@/app/lib/validators/common";
import { useAuth } from "@/app/hooks/useAuth";
import CustomLoader from "@/app/components/feedback/CustomLoader";

interface DealerRegisterForm {
  name: string;
  email: string;
  contactPhone: string;
  password: string;
  emailOtpCode: string;
  businessName: string;
}

const DealerRegister = () => {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [signup, { isLoading, error }] = useSignupMutation();
  const [applyDealerAccess, { isLoading: isApplying, error: applyError }] =
    useApplyDealerAccessMutation();
  const [successMessage, setSuccessMessage] = useState("");
  const submissionError = isAuthenticated ? applyError : error;
  const apiErrorMessage = getApiErrorMessage(
    submissionError,
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

  const {
    control,
    register,
    watch,
    getValues,
    setValue,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<DealerRegisterForm>({
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      contactPhone: "",
      password: "",
      emailOtpCode: "",
      businessName: "",
    },
  });

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    setValue("name", user.name || "", { shouldDirty: false });
    setValue("email", user.email || "", { shouldDirty: false });
    setValue("contactPhone", normalizePhoneDigits(user.phone || "", 10), {
      shouldDirty: false,
      shouldValidate: false,
    });
  }, [isAuthenticated, setValue, user]);

  const handleSendOtp = async () => {
    await sendOtp(getValues("email"), getValues("contactPhone"));
  };

  const canRequestOtp =
    canSendOtp &&
    validateEmailValue(watch("email")) === true &&
    validateTenDigitPhone(watch("contactPhone")) === true;

  const onSubmit = async (formData: DealerRegisterForm) => {
    try {
      if (isAuthenticated) {
        const response = await applyDealerAccess({
          businessName: sanitizeTextInput(formData.businessName),
          contactPhone: normalizePhoneDigits(
            formData.contactPhone || user?.phone || "",
            10
          ),
        }).unwrap();

        setSuccessMessage(
          response.message ||
            "Dealer request submitted. An admin will review your request."
        );
        return;
      }

      await signup({
        name: sanitizeTextInput(formData.name),
        email: normalizeEmailValue(formData.email),
        phone: normalizePhoneDigits(formData.contactPhone, 10),
        password: formData.password,
        emailOtpCode: formData.emailOtpCode.replace(/\D/g, "").slice(0, 6),
        requestDealerAccess: true,
        businessName: sanitizeTextInput(formData.businessName),
        contactPhone: normalizePhoneDigits(formData.contactPhone, 10),
      }).unwrap();

      setSuccessMessage(
        "Dealer request submitted. An admin will approve your account before you can sign in."
      );
      reset();
    } catch {
      // Error handled by mutation state.
    }
  };

  if (isAuthLoading) {
    return <CustomLoader />;
  }

  return (
    <MainLayout>
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
        <main className="w-full max-w-md bg-white rounded-lg shadow-lg p-6 sm:p-8">
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 text-center mb-2">
            Dealer Registration
          </h2>
          <p className="text-sm text-gray-600 text-center mb-6">
            {isAuthenticated
              ? "Apply dealer access for your current account. Admin approval is required."
              : "Submit your business details. Admin approval is required for dealer pricing access."}
          </p>

          {isAuthenticated && user ? (
            <div className="mb-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              Applying as <span className="font-semibold">{user.email}</span>
            </div>
          ) : null}

          {successMessage && (
            <div className="bg-green-50 border border-green-300 text-green-700 text-center text-sm p-3 rounded mb-4">
              {successMessage}
            </div>
          )}

          {submissionError && (
            <div className="bg-red-50 border border-red-300 text-red-600 text-center text-sm p-3 rounded mb-4">
              {apiErrorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {!isAuthenticated ? (
              <>
                <Input
                  name="name"
                  type="text"
                  placeholder="Contact person name"
                  control={control}
                  validation={{
                    required: "Name is required",
                    validate: (value: string) => validateDisplayName(value),
                  }}
                  onChange={(event) => {
                    setValue("name", sanitizeLooseTextInput(event.target.value), {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                  }}
                  error={errors.name?.message}
                  className="py-2.5 text-sm"
                />

                <Input
                  name="email"
                  type="email"
                  placeholder="Business email"
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
              </>
            ) : null}

            <Input
              name="contactPhone"
              type="tel"
              placeholder="Contact phone"
              control={control}
              validation={{
                required: "Contact phone is required",
                validate: (value: string) => validateTenDigitPhone(value),
              }}
              onChange={(event) => {
                setValue(
                  "contactPhone",
                  normalizePhoneDigits(event.target.value, 10),
                  { shouldValidate: true, shouldDirty: true }
                );
              }}
              error={errors.contactPhone?.message}
              className="py-2.5 text-sm"
            />

            <Input
              name="businessName"
              type="text"
              placeholder="Business name"
              control={control}
              validation={{
                required: "Business name is required",
                validate: (value: string) => validateBusinessName(value),
              }}
              onChange={(event) => {
                setValue("businessName", sanitizeLooseTextInput(event.target.value), {
                  shouldValidate: true,
                  shouldDirty: true,
                });
              }}
              error={errors.businessName?.message}
              className="py-2.5 text-sm"
            />

            {!isAuthenticated ? (
              <>
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
                    disabled={!canRequestOtp}
                    className={`btn-base w-full border border-indigo-600 text-indigo-600 hover:bg-indigo-50 ${
                      !canRequestOtp ? "cursor-not-allowed opacity-70" : ""
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
                    onChange={(event) => {
                      setValue(
                        "emailOtpCode",
                        event.target.value.replace(/\D/g, "").slice(0, 6),
                        { shouldValidate: true, shouldDirty: true }
                      );
                    }}
                    error={errors.emailOtpCode?.message}
                    className="py-2.5 text-sm"
                  />
                </div>
              </>
            ) : null}

            <button
              type="submit"
              disabled={(isLoading || isApplying) || !isValid}
              className={`btn-primary w-full ${
                (isLoading || isApplying) || !isValid
                  ? "cursor-not-allowed bg-gray-400"
                  : ""
              }`}
            >
              {isLoading || isApplying ? (
                <Loader2 className="animate-spin mx-auto" size={20} />
              ) : isAuthenticated ? (
                "Apply For Dealer Access"
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
            <Link
              href={isAuthenticated ? "/profile" : "/sign-in"}
              className="text-indigo-600 hover:underline"
            >
              {isAuthenticated ? "Back to profile" : "Back to sign in"}
            </Link>
          </div>
        </main>
      </div>
    </MainLayout>
  );
};

export default DealerRegister;
