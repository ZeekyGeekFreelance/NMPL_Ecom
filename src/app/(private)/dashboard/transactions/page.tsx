import { MainLayout } from "@/app/components/layout/MainLayout";
import prisma from "@/lib/db";
import Link from "next/link";

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const limit = 20;
  const status = sp.status ?? undefined;
  const where: any = {};
  if (status) where.status = status;

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit,
      include: { order: { include: { user: { select: { name: true, email: true } } } } },
    }),
    prisma.transaction.count({ where }),
  ]);

  const statusColors: Record<string, string> = {
    PENDING_VERIFICATION: "bg-yellow-100 text-yellow-700",
    CONFIRMED: "bg-green-100 text-green-700",
    DELIVERED: "bg-blue-100 text-blue-700",
    QUOTATION_REJECTED: "bg-red-100 text-red-700",
    AWAITING_PAYMENT: "bg-purple-100 text-purple-700",
  };

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Transactions ({total})</h1>
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {["Order ID", "Customer", "Amount", "Status", "Date"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-700">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/transactions/${t.id}`} className="font-medium text-blue-600 hover:underline">
                      {t.orderId.slice(0, 8).toUpperCase()}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{t.order?.user?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">₹{Number(t.order?.amount ?? 0).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[t.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {t.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {transactions.length === 0 && <div className="text-center py-10 text-gray-500">No transactions found</div>}
        </div>
      </div>
    </MainLayout>
  );
}
