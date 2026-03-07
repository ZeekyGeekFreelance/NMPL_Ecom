"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import Button from "@/app/components/atoms/Button";
import MainLayout from "@/app/components/templates/MainLayout";
import { useForgotPasswordMutation } from "@/app/store/apis/AuthApi";
import Input from "@/app/components/atoms/Input";
import {
  normalizeEmailValue,
  validateEmailValue,
} from "@/app/lib/validators/common";

interface PasswordResetRequestForm {
  email: string;
}

const PasswordReset = () => {
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<PasswordResetRequestForm>({
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      email: "",
    },
  });

  const watchedEmail = watch("email");

  useEffect(() => {
    if (successMessage) {
      setSuccessMessage("");
    }
    if (errorMessage) {
      setErrorMessage("");
    }
  }, [watchedEmail]);

  const handleRequestLink = async (values: PasswordResetRequestForm) => {
    const normalizedEmail = normalizeEmailValue(values.email);
    try {
      const response = await forgotPassword({ email: normalizedEmail }).unwrap();
      setSuccessMessage(
        response?.message ||
          "If an account exists for this email, a password reset link has been sent."
      );
      setErrorMessage("");
    } catch (error: any) {
      setErrorMessage(
        error?.data?.message || "Unable to send password reset link right now."
      );
      setSuccessMessage("");
    }
  };

  return (
    <MainLayout>
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 rounded shadow-md w-full max-w-lg">
          {successMessage && (
            <div className="bg-green-100 border border-green-400 text-center text-green-700 w-full px-4 py-4 rounded mb-4">
              <span className="block">{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-100 border border-red-400 text-center text-red-700 w-full px-4 py-4 rounded mb-4">
              <span className="block">{errorMessage}</span>
            </div>
          )}

          <h2 className="text-lg font-medium mb-3">Reset Password</h2>
          <p className="text-sm text-gray-700 mb-4">
            Enter your registered email address. We will send a password reset link.
          </p>

          <form onSubmit={handleSubmit(handleRequestLink)} className="space-y-3">
            <Input
              name="email"
              type="email"
              placeholder="you@example.com"
              control={control}
              validation={{
                required: "Email is required.",
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

            <Button
              type="submit"
              className={`bg-primary text-white w-full py-[12px] rounded ${
                isLoading || !isValid ? "cursor-not-allowed opacity-60" : ""
              }`}
              disabled={isLoading || !isValid}
            >
              {isLoading ? "Sending..." : "Send reset link"}
            </Button>
          </form>

          <Link className="mt-4 inline-block hover:underline text-sm" href="/sign-in">
            Back to sign in
          </Link>
        </div>
      </div>
    </MainLayout>
  );
};

export default PasswordReset;
