"use client";

import { useForm } from "react-hook-form";
import Input from "@/app/components/atoms/Input";
import { useRouter } from "next/navigation";
import MainLayout from "@/app/components/templates/MainLayout";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { API_BASE_URL } from "@/app/lib/constants/config";
import { useAppDispatch } from "@/app/store/hooks";
import { setUser } from "@/app/store/slices/AuthSlice";

interface InputForm {
  newPassword: string;
  confirmPassword: string;
}

const DealerChangePassword = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedEmail = sessionStorage.getItem('dealer_temp_email');
    const storedPassword = sessionStorage.getItem('dealer_temp_password');
    
    if (!storedEmail || !storedPassword) {
      router.push('/dealer/sign-in');
      return;
    }
    
    setEmail(storedEmail);
    setCurrentPassword(storedPassword);
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

  const onSubmit = async (formData: InputForm) => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email,
          currentPassword,
          newPassword: formData.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to change password");
      }

      // Clear temporary storage
      sessionStorage.removeItem('dealer_temp_email');
      sessionStorage.removeItem('dealer_temp_password');

      // Update user state
      if (data.data?.user) {
        dispatch(setUser({ user: data.data.user }));
      }

      // Force a small delay to ensure cookies are set
      await new Promise(resolve => setTimeout(resolve, 100));

      // Redirect to dealer portal with full page reload to ensure auth state is fresh
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message || "Unable to change password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!email) {
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

          {error && (
            <div className="bg-red-50 border border-red-300 text-red-600 text-center text-sm p-3 rounded mb-4">
              {error}
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
