import { MainLayout } from "@/app/components/layout/MainLayout";
import prisma from "@/lib/db";
export default async function BrandsPage() {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } }).catch(() => []);
  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Brands & Categories</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((c) => (
            <a key={c.id} href={`/shop?categoryId=${c.id}`} className="bg-white border border-gray-200 rounded-xl p-6 text-center hover:shadow-md transition-shadow">
              <div className="font-semibold text-gray-900">{c.name}</div>
            </a>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
