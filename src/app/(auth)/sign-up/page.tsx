"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSignUpMutation } from "@/app/store/endpoints/auth";
import { useAppDispatch } from "@/app/store/hooks";
import { setUser } from "@/app/store/auth.slice";
import { addToast } from "@/app/store/toast.slice";
import { useRouter } from "next/navigation";
import Link from "next/link";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().optional(),
});
type Form = z.infer<typeof schema>;

export default function SignUpPage() {
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });
  const [signUp, { isLoading }] = useSignUpMutation();
  const dispatch = useAppDispatch();
  const router = useRouter();

  const onSubmit = async (data: Form) => {
    try {
      const res = await signUp(data).unwrap();
      dispatch(setUser(res.data));
      dispatch(addToast({ type: "success", message: "Account created!" }));
      router.push("/");
    } catch (err: any) {
      dispatch(addToast({ type: "error", message: err?.data?.message ?? "Registration failed" }));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Create account</h1>
        <p className="text-gray-500 text-sm mb-6">Join NMPL today</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {[
            { id: "name", label: "Full Name", type: "text", placeholder: "John Doe", error: errors.name },
            { id: "email", label: "Email", type: "email", placeholder: "you@example.com", error: errors.email },
            { id: "password", label: "Password", type: "password", placeholder: "Min 8 characters", error: errors.password },
            { id: "phone", label: "Phone (optional)", type: "tel", placeholder: "10-digit mobile number", error: undefined },
          ].map((field) => (
            <div key={field.id}>
              <label className="text-sm font-medium text-gray-700 block mb-1">{field.label}</label>
              <input {...register(field.id as any)} type={field.type} placeholder={field.placeholder}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              {field.error && <p className="text-xs text-red-600 mt-1">{field.error.message}</p>}
            </div>
          ))}
          <button disabled={isLoading} className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50">
            {isLoading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-blue-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
