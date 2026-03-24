"use client";

import { useForm } from "react-hook-form";
import Input from "@/app/components/atoms/Input";
import { useRouter } from "next/navigation";
import MainLayout from "@/app/components/templates/MainLayout";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useChangePasswordOnFirstLoginMutation } from "@/app/store/apis/AuthApi";
import {
  clearFirstLoginState,
  readFirstLoginState,
  resolvePostPasswordChangeDestination,
} from "@/app/lib/firstLoginPasswordFlow";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";

interface InputForm {
  newPassword: string;
  confirmPassword: string;
}

const DealerChangePassword = () => {
  const router = useRouter();
  const [changePasswordOnFirstLogin, { isLoading, error: mutationError }] =
    useChangePasswordOnFirstLoginMutation();
  const [firstLoginState, setFirstLoginState] = useState<ReturnType<typeof readFirstLoginState>>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedState = readFirstLoginState();
    
    if (!storedState || storedState.portal !== "DEALER_PORTAL") {
      router.push("/dealer/sign-in");
      return;
    }
    
    setFirstLoginState(storedState);
  }, [router]);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<InputForm>({
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const newPassword = watch("newPassword");
  const mutationErrorMessage = getApiErrorMessage(mutationError);

  const onSubmit = async (formData: InputForm) => {
    setError("");

    try {
      const response = await changePasswordOnFirstLogin({
        email: firstLoginState!.email,
        currentPassword: firstLoginState!.currentPassword,
        newPassword: formData.newPassword,
      }).unwrap();

      clearFirstLoginState();

      await new Promise(resolve => setTimeout(resolve, 100));

      window.location.href = resolvePostPasswordChangeDestination(
        response.user,
        firstLoginState?.nextPath
      );
    } catch (err: any) {
      const message = getApiErrorMessage(err);
      setError(message || "Unable to change password. Please try again.");
    }
  };

  if (!firstLoginState) {
    return null;
  }

  return (
    <MainLayout>
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
        <main className="w-full max-w-md bg-white rounded-lg shadow-lg p-6 sm:p-8">
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 text-center mb-2">
            Change Password
          </h2>
          <p className="text-sm text-gray-600 text-center mb-6">
            You must change your temporary password before accessing your dealer account.
          </p>

          {(error || mutationErrorMessage) && (
            <div className="bg-red-50 border border-red-300 text-red-600 text-center text-sm p-3 rounded mb-4">
              {error || mutationErrorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              name="newPassword"
              type="password"
              placeholder="New password"
              control={control}
              validation={{
                required: "New password is required",
                minLength: {
                  value: 8,
                  message: "Password must be at least 8 characters long",
                },
              }}
              error={errors.newPassword?.message}
              className="py-2.5 text-sm"
            />

            <Input
              name="confirmPassword"
              type="password"
              placeholder="Confirm new password"
              control={control}
              validation={{
                required: "Please confirm your password",
                validate: (value: string) =>
                  value === newPassword || "Passwords do not match",
              }}
              error={errors.confirmPassword?.message}
              className="py-2.5 text-sm"
            />

            <button
              type="submit"
              disabled={isLoading || !isValid}
              className="btn-primary w-full"
            >
              {isLoading ? (
                <Loader2 className="animate-spin mx-auto" size={20} />
              ) : (
                "Change Password & Sign In"
              )}
            </button>
          </form>
        </main>
      </div>
    </MainLayout>
  );
};

export default DealerChangePassword;
