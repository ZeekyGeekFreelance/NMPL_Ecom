"use client";
import { MainLayout } from "@/app/components/layout/MainLayout";
import { useGetOrdersQuery } from "@/app/store/endpoints/orders";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  PENDING_VERIFICATION: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  DELIVERED: "bg-green-100 text-green-700",
  QUOTATION_REJECTED: "bg-red-100 text-red-700",
  AWAITING_PAYMENT: "bg-purple-100 text-purple-700",
};

export default function OrdersPage() {
  const { data, isLoading } = useGetOrdersQuery({ page: 1, limit: 20 });
  const orders = data?.data?.orders ?? [];

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">My Orders</h1>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin" size={40} /></div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📦</div>
            <p className="text-gray-500 mb-6">No orders yet</p>
            <Link href="/shop" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors">
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order: any) => (
              <Link key={order.id} href={`/orders/${order.id}`} className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-gray-900">Order #{order.id.slice(0, 8).toUpperCase()}</div>
                    <div className="text-sm text-gray-500 mt-0.5">{format(new Date(order.createdAt), "MMM d, yyyy")}</div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[order.status] ?? "bg-gray-100 text-gray-700"}`}>
                    {order.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">{order.orderItems?.length ?? 0} item(s)</div>
                  <div className="font-bold text-gray-900">₹{Number(order.amount).toLocaleString("en-IN")}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
