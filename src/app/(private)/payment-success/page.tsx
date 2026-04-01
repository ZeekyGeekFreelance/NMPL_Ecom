import Link from "next/link";
import { MainLayout } from "@/app/components/layout/MainLayout";
import { CheckCircle } from "lucide-react";
export default function PaymentSuccessPage() {
  return (
    <MainLayout>
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <CheckCircle className="text-green-500 mx-auto mb-4" size={64} />
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Order Placed!</h1>
          <p className="text-gray-500 mb-6">Your order has been placed and is pending verification.</p>
          <Link href="/orders" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors">View Orders</Link>
        </div>
      </div>
    </MainLayout>
  );
}
