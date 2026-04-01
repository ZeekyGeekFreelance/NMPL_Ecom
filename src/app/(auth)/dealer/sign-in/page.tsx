"use client";
import { useForm } from "react-hook-form";
import { useSignInMutation } from "@/app/store/endpoints/auth";
import { useAppDispatch } from "@/app/store/hooks";
import { setUser } from "@/app/store/auth.slice";
import { addToast } from "@/app/store/toast.slice";
import { useRouter } from "next/navigation";
import Link from "next/link";
export default function DealerSignInPage() {
  const { register, handleSubmit } = useForm<{ email: string; password: string }>();
  const [signIn, { isLoading }] = useSignInMutation();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const onSubmit = async (data: any) => {
    try {
      const res = await signIn(data).unwrap();
      dispatch(setUser(res.data));
      router.push("/dashboard");
    } catch (err: any) {
      dispatch(addToast({ type: "error", message: err?.data?.message ?? "Sign-in failed" }));
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Dealer Sign In</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-6">
          <input {...register("email")} type="email" placeholder="dealer@email.com" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
          <input {...register("password")} type="password" placeholder="Password" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
          <button disabled={isLoading} className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50">
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">Not a dealer? <Link href="/dealer/register" className="text-blue-600 hover:underline">Register</Link></p>
      </div>
    </div>
  );
}
