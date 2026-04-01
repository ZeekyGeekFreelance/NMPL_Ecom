import { MainLayout } from "@/app/components/layout/MainLayout";
import prisma from "@/lib/db";
import Link from "next/link";
import { subDays, startOfMonth, endOfMonth } from "date-fns";

export default async function AnalyticsPage() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const thirtyDaysAgo = subDays(now, 30);

  const [totalOrders, monthOrders, totalRevenue, monthRevenue, totalUsers, newUsersThisMonth, topProducts] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } }),
    prisma.order.aggregate({ _sum: { amount: true } }),
    prisma.order.aggregate({ _sum: { amount: true }, where: { createdAt: { gte: monthStart, lte: monthEnd } } }),
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.product.findMany({ where: { isDeleted: false }, orderBy: { salesCount: "desc" }, take: 5, select: { name: true, salesCount: true } }),
  ]).catch(() => [0, 0, { _sum: { amount: null } }, { _sum: { amount: null } }, 0, 0, []]);

  const stats = [
    { label: "Total Orders", value: String(totalOrders), color: "bg-blue-50 text-blue-800" },
    { label: "This Month Orders", value: String(monthOrders), color: "bg-indigo-50 text-indigo-800" },
    { label: "Total Revenue", value: `₹${Number((totalRevenue as any)?._sum?.amount ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, color: "bg-green-50 text-green-800" },
    { label: "Monthly Revenue", value: `₹${Number((monthRevenue as any)?._sum?.amount ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, color: "bg-emerald-50 text-emerald-800" },
    { label: "Total Users", value: String(totalUsers), color: "bg-purple-50 text-purple-800" },
    { label: "New Users (Month)", value: String(newUsersThisMonth), color: "bg-pink-50 text-pink-800" },
  ];

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
          {stats.map((s) => (
            <div key={s.label} className={`${s.color} rounded-xl p-5`}>
              <div className="text-2xl font-bold mb-1">{s.value}</div>
              <div className="text-sm font-medium">{s.label}</div>
            </div>
          ))}
        </div>

        {Array.isArray(topProducts) && topProducts.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-bold text-gray-900 mb-4">Top Products by Sales</h2>
            <div className="space-y-3">
              {topProducts.map((p: any, i: number) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="w-6 text-sm text-gray-500 font-medium">#{i + 1}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-blue-600 h-full rounded-full" style={{ width: `${Math.min(100, (p.salesCount / ((topProducts[0] as any).salesCount || 1)) * 100)}%` }} />
                  </div>
                  <span className="text-sm text-gray-700 font-medium w-40 truncate">{p.name}</span>
                  <span className="text-sm text-gray-500">{p.salesCount} sold</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
