"use client";
import { useForm } from "react-hook-form";
import { useRegisterDealerMutation } from "@/app/store/endpoints/auth";
import { useAppDispatch } from "@/app/store/hooks";
import { setUser } from "@/app/store/auth.slice";
import { addToast } from "@/app/store/toast.slice";
import { useRouter } from "next/navigation";
export default function DealerRegisterPage() {
  const { register, handleSubmit } = useForm();
  const [registerDealer, { isLoading }] = useRegisterDealerMutation();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const onSubmit = async (data: any) => {
    try {
      const res = await registerDealer(data).unwrap();
      dispatch(setUser(res.data));
      dispatch(addToast({ type: "success", message: "Registration submitted! Pending approval." }));
      router.push("/");
    } catch (err: any) {
      dispatch(addToast({ type: "error", message: err?.data?.message ?? "Registration failed" }));
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Dealer Registration</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {[["name","Full Name","text"],["email","Email","email"],["password","Password","password"],["businessName","Business Name","text"],["phone","Phone","tel"]].map(([id,placeholder,type]) => (
            <input key={id} {...register(id as string)} type={type} placeholder={placeholder} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
          ))}
          <button disabled={isLoading} className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50">
            {isLoading ? "Submitting..." : "Submit Application"}
          </button>
        </form>
      </div>
    </div>
  );
}
