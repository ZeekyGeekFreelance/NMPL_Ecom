"use client";
import { useForm } from "react-hook-form";
import { useForgotPasswordMutation } from "@/app/store/endpoints/auth";
import { useAppDispatch } from "@/app/store/hooks";
import { addToast } from "@/app/store/toast.slice";
import Link from "next/link";
export default function PasswordResetPage() {
  const { register, handleSubmit } = useForm<{ email: string }>();
  const [forgot, { isLoading, isSuccess }] = useForgotPasswordMutation();
  const dispatch = useAppDispatch();
  const onSubmit = async ({ email }: { email: string }) => {
    try { await forgot({ email }).unwrap(); }
    catch (err: any) { dispatch(addToast({ type: "error", message: err?.data?.message ?? "Failed" })); }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Reset Password</h1>
        <p className="text-gray-500 text-sm mb-6">Enter your email to receive a reset link</p>
        {isSuccess ? (
          <div className="bg-green-50 text-green-700 p-4 rounded-xl text-sm">If that email exists, a reset link has been sent.</div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <input {...register("email", { required: true })} type="email" placeholder="you@example.com" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
            <button disabled={isLoading} className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50">
              {isLoading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}
        <p className="text-center text-sm text-gray-500 mt-4"><Link href="/sign-in" className="text-blue-600 hover:underline">Back to Sign In</Link></p>
      </div>
    </div>
  );
}
