"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSignInMutation } from "@/app/store/endpoints/auth";
import { useAppDispatch } from "@/app/store/hooks";
import { setUser } from "@/app/store/auth.slice";
import { addToast } from "@/app/store/toast.slice";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
type Form = z.infer<typeof schema>;

export default function SignInPage() {
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });
  const [signIn, { isLoading }] = useSignInMutation();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();

  const onSubmit = async (data: Form) => {
    try {
      const res = await signIn(data).unwrap();
      dispatch(setUser(res.data));
      dispatch(addToast({ type: "success", message: "Signed in!" }));
      const redirect = searchParams.get("redirect") ?? "/";
      router.push(redirect);
    } catch (err: any) {
      dispatch(addToast({ type: "error", message: err?.data?.message ?? "Sign-in failed" }));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
        <p className="text-gray-500 text-sm mb-6">Sign in to your account</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Email</label>
            <input {...register("email")} type="email" placeholder="you@example.com" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Password</label>
            <input {...register("password")} type="password" placeholder="••••••••" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>}
          </div>
          <div className="flex justify-end">
            <Link href="/password-reset" className="text-xs text-blue-600 hover:underline">Forgot password?</Link>
          </div>
          <button disabled={isLoading} className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50">
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          No account?{" "}
          <Link href="/sign-up" className="text-blue-600 font-medium hover:underline">Sign up</Link>
        </p>
        <p className="text-center text-sm text-gray-500 mt-2">
          <Link href="/dealer/sign-in" className="text-blue-600 font-medium hover:underline">Dealer sign-in →</Link>
        </p>
      </div>
    </div>
  );
}
