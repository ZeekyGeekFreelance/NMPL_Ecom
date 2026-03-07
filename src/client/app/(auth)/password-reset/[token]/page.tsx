"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import Input from "@/app/components/atoms/Input";
import Button from "@/app/components/atoms/Button";
import { useResetPasswordMutation } from "@/app/store/apis/AuthApi";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";
import { validatePasswordPolicy } from "@/app/lib/validators/common";

type ResetPasswordForm = {
  password: string;
  confirmPassword: string;
};

const PasswordResetWithToken = () => {
  const {
    handleSubmit,
    control,
    watch,
    trigger,
    formState: { errors, isValid },
  } = useForm<ResetPasswordForm>({
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const { token } = useParams();
  const [resetPassword, { isLoading }] = useResetPasswordMutation();
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const passwordValue = watch("password");
  const confirmPasswordValue = watch("confirmPassword");

  useEffect(() => {
    if (confirmPasswordValue) {
      void trigger("confirmPassword");
    }
  }, [confirmPasswordValue, passwordValue, trigger]);

  const onSubmit = async (formData: ResetPasswordForm) => {
    try {
      await resetPassword({
        token: token as string,
        newPassword: formData.password,
      }).unwrap();
      setMessage("Password reset successful! You can now log in.");
      setIsError(false);
    } catch (error) {
      setMessage(
        getApiErrorMessage(error, "Unable to reset password. Please try again.")
      );
      setIsError(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex w-full max-w-[500px] flex-col items-center justify-center gap-4 rounded bg-white p-6 shadow-md"
      >
        <h1 className="text-2xl font-bold mb-4">Reset Your Password</h1>

        {message && (
          <div
            className={`w-full text-center py-[22px] mb-4 rounded ${
              isError
                ? "bg-red-100 text-red-700 border-2 border-red-400"
                : "bg-green-100 text-green-700"
            }`}
          >
            {message}
          </div>
        )}

        <Input
          type="password"
          name="password"
          placeholder="New Password"
          control={control}
          validation={{
            required: "Password is required",
            validate: (value: string) => validatePasswordPolicy(value),
          }}
          error={errors.password?.message}
          className="py-4"
        />

        <Input
          type="password"
          name="confirmPassword"
          placeholder="Confirm Password"
          control={control}
          validation={{
            required: "Confirm your password",
            validate: (value: string) =>
              value === passwordValue || "Passwords do not match",
          }}
          error={errors.confirmPassword?.message}
          className="py-4"
        />

        <Button
          type="submit"
          className="bg-primary mt-4 text-white w-full py-[12px] rounded"
          disabled={isLoading || !isValid}
        >
          {isLoading ? "Resetting..." : "Reset Password"}
        </Button>

        <Link className="mt-4 hover:underline" href={"/sign-in"}>
          Return to sign in
        </Link>
      </form>
    </div>
  );
};

export default PasswordResetWithToken;
