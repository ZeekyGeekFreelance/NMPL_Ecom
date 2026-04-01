import { MainLayout } from "@/app/components/layout/MainLayout";
import prisma from "@/lib/db";
import Link from "next/link";

export default async function DashboardProductsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const limit = 20;
  const search = sp.search ?? undefined;
  const where: any = { isDeleted: false };
  if (search) where.name = { contains: search, mode: "insensitive" };

  const [products, total] = await Promise.all([
    prisma.product.findMany({ where, include: { variants: true, category: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    prisma.product.count({ where }),
  ]);

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Products ({total})</h1>
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Name", "Category", "Variants", "Status", "Created"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-700">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.category?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{p.variants.length}</td>
                  <td className="px-4 py-3">
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">Active</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {products.length === 0 && <div className="text-center py-10 text-gray-500">No products found</div>}
        </div>
      </div>
    </MainLayout>
  );
}
