"use client";
import { useForm } from "react-hook-form";
import Input from "@/app/components/atoms/Input";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import PasswordField from "@/app/components/molecules/PasswordField";
import MainLayout from "@/app/components/templates/MainLayout";
import { useSignupMutation } from "@/app/store/apis/AuthApi";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";
import GuestOnlyGuard from "@/app/components/auth/GuestOnlyGuard";
import { useRegistrationOtp } from "../shared/useRegistrationOtp";
import {
  normalizeEmailValue,
  normalizePhoneDigits,
  sanitizeLooseTextInput,
  sanitizeTextInput,
  validateDisplayName,
  validateEmailValue,
  validateTenDigitPhone,
} from "@/app/lib/validators/common";

interface InputForm {
  name: string;
  email: string;
  phone: string;
  password: string;
  emailOtpCode: string;
}

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
  const searchParams = useSearchParams();
  const apiErrorMessage = getApiErrorMessage(
    error,
    "Signup failed. Please try again."
  );

  const {
    register,
    watch,
    getValues,
    setValue,
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<InputForm>({
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      emailOtpCode: "",
    },
  });

  const onSubmit = async (formData: InputForm) => {
    try {
      await signUp({
        ...formData,
        name: sanitizeTextInput(formData.name),
        email: normalizeEmailValue(formData.email),
        phone: normalizePhoneDigits(formData.phone, 10),
        emailOtpCode: formData.emailOtpCode.replace(/\D/g, "").slice(0, 6),
      }).unwrap();
      const requestedNextPath = searchParams.get("next");
      const nextPath =
        requestedNextPath && requestedNextPath.startsWith("/")
          ? requestedNextPath
          : null;
      router.push(nextPath || "/");
    } catch {
      // Error is surfaced from mutation state.
    }
  };

  const handleSendOtp = async () => {
    const email = getValues("email");
    const phone = getValues("phone");
    await sendOtp(email, phone);
  };

  const canRequestOtp =
    canSendOtp &&
    validateEmailValue(watch("email")) === true &&
    validateTenDigitPhone(watch("phone")) === true;

  return (
    <GuestOnlyGuard>
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
          <main className="w-full max-w-md bg-white rounded-lg shadow-lg p-6 sm:p-8">
            <h2 className="type-h2 text-gray-800 text-center mb-6">
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
                name="phone"
                type="tel"
                placeholder="Phone number"
                control={control}
                validation={{
                  required: "Phone number is required",
                  validate: (value: string) => validateTenDigitPhone(value),
                }}
                onChange={(event) => {
                  setValue(
                    "phone",
                    normalizePhoneDigits(event.target.value, 10),
                    { shouldValidate: true, shouldDirty: true }
                  );
                }}
                error={errors.phone?.message}
                className="py-2.5 text-sm"
              />

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Verify email</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Request OTP and enter the 6-digit email code to continue.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={!canRequestOtp}
                  className={`btn-base w-full border font-medium ${
                    !canRequestOtp ? "cursor-not-allowed opacity-70" : ""
                  }`}
                  style={!canRequestOtp
                    ? { borderColor: 'var(--color-border-dark)', color: 'var(--color-text-muted)' }
                    : { borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }
                  }
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

              <PasswordField register={register} watch={watch} errors={errors} />

              <button
                type="submit"
                disabled={isLoading || !isValid}
                className="btn-primary w-full"
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
              <Link href="/sign-in" className="font-medium hover:underline" style={{ color: 'var(--color-primary)' }}>
                Sign in
              </Link>
            </div>


          </main>
        </div>
      </MainLayout>
    </GuestOnlyGuard>
  );
};

export default Signup;
