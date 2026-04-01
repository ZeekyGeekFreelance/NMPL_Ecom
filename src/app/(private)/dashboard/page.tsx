import { MainLayout } from "@/app/components/layout/MainLayout";
import prisma from "@/lib/db";
import Link from "next/link";

async function getDashboardStats() {
  try {
    const [totalOrders, totalRevenue, totalUsers, totalProducts, pendingOrders] = await Promise.all([
      prisma.order.count(),
      prisma.order.aggregate({ _sum: { amount: true } }),
      prisma.user.count(),
      prisma.product.count({ where: { isDeleted: false } }),
      prisma.order.count({ where: { status: "PENDING_VERIFICATION" } }),
    ]);
    return {
      totalOrders,
      totalRevenue: totalRevenue._sum.amount ?? 0,
      totalUsers,
      totalProducts,
      pendingOrders,
    };
  } catch {
    return { totalOrders: 0, totalRevenue: 0, totalUsers: 0, totalProducts: 0, pendingOrders: 0 };
  }
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  const cards = [
    { title: "Total Orders", value: stats.totalOrders.toLocaleString(), href: "/dashboard/transactions", color: "bg-blue-50 text-blue-700" },
    { title: "Revenue", value: `₹${stats.totalRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, href: "/dashboard/analytics", color: "bg-green-50 text-green-700" },
    { title: "Users", value: stats.totalUsers.toLocaleString(), href: "/dashboard/users", color: "bg-purple-50 text-purple-700" },
    { title: "Products", value: stats.totalProducts.toLocaleString(), href: "/dashboard/products", color: "bg-orange-50 text-orange-700" },
    { title: "Pending Orders", value: stats.pendingOrders.toLocaleString(), href: "/dashboard/transactions?status=PENDING_VERIFICATION", color: "bg-yellow-50 text-yellow-700" },
  ];

  const navLinks = [
    { href: "/dashboard/products", label: "🏷️ Products" },
    { href: "/dashboard/categories", label: "📂 Categories" },
    { href: "/dashboard/attributes", label: "🔧 Attributes" },
    { href: "/dashboard/inventory", label: "📦 Inventory" },
    { href: "/dashboard/transactions", label: "📋 Transactions" },
    { href: "/dashboard/payments", label: "💳 Payments" },
    { href: "/dashboard/dealers", label: "🤝 Dealers" },
    { href: "/dashboard/users", label: "👥 Users" },
    { href: "/dashboard/analytics", label: "📊 Analytics" },
    { href: "/dashboard/gst", label: "🧾 GST" },
    { href: "/dashboard/delivery-fees", label: "🚚 Delivery Fees" },
    { href: "/dashboard/logs", label: "📝 Logs" },
    { href: "/dashboard/reports", label: "📈 Reports" },
  ];

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
          {cards.map((card) => (
            <Link key={card.title} href={card.href} className={`${card.color} rounded-xl p-5 hover:opacity-90 transition-opacity`}>
              <div className="text-2xl font-bold mb-1">{card.value}</div>
              <div className="text-sm font-medium">{card.title}</div>
            </Link>
          ))}
        </div>

        {/* Navigation */}
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Navigation</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="bg-white border border-gray-200 rounded-xl p-4 hover:bg-gray-50 hover:shadow-sm transition-all text-sm font-medium text-gray-700">
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
