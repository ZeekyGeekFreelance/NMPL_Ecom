import { MainLayout } from "@/app/components/layout/MainLayout";
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      order: {
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          orderItems: { include: { variant: { include: { product: { select: { name: true } } } } } },
          address: true,
          quotationLogs: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!transaction) return notFound();

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Transaction #{transaction.orderId.slice(0, 8).toUpperCase()}</h1>
          <Link href="/dashboard/transactions" className="text-sm text-blue-600 hover:underline">← Back</Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Customer</h2>
            <div className="text-sm space-y-1 text-gray-600">
              <div><span className="text-gray-500">Name:</span> {transaction.order?.user?.name}</div>
              <div><span className="text-gray-500">Email:</span> {transaction.order?.user?.email}</div>
              {transaction.order?.user?.phone && <div><span className="text-gray-500">Phone:</span> {transaction.order.user.phone}</div>}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Order</h2>
            <div className="text-sm space-y-1 text-gray-600">
              <div><span className="text-gray-500">Status:</span> {transaction.status.replace(/_/g, " ")}</div>
              <div><span className="text-gray-500">Amount:</span> ₹{Number(transaction.order?.amount ?? 0).toLocaleString("en-IN")}</div>
              <div><span className="text-gray-500">Date:</span> {format(new Date(transaction.createdAt), "MMM d, yyyy")}</div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
