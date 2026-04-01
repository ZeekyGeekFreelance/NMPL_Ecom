import { MainLayout } from "@/app/components/layout/MainLayout";
import prisma from "@/lib/db";
import { ProductCard } from "@/app/components/ui/ProductCard";

async function getShopData(searchParams: Record<string, string>) {
  const { search, categoryId, page: pageStr = "1" } = searchParams;
  const page = Math.max(1, Number(pageStr));
  const limit = 24;
  const where: any = { isDeleted: false };
  if (search) where.name = { contains: search, mode: "insensitive" };
  if (categoryId) where.categoryId = categoryId;

  const [products, total, categories] = await Promise.all([
    prisma.product.findMany({ where, include: { variants: true, category: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    prisma.product.count({ where }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);
  return { products, total, categories, page, limit, totalPages: Math.ceil(total / limit) };
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { products, total, categories, page, totalPages } = await getShopData(sp);

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="hidden md:block w-64 shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Categories</h3>
              <ul className="space-y-1">
                <li>
                  <a href="/shop" className="block px-3 py-2 rounded-lg text-sm hover:bg-gray-100 transition-colors text-gray-700">
                    All Products
                  </a>
                </li>
                {categories.map((cat) => (
                  <li key={cat.id}>
                    <a href={`/shop?categoryId=${cat.id}`} className={`block px-3 py-2 rounded-lg text-sm hover:bg-gray-100 transition-colors ${sp.categoryId === cat.id ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700"}`}>
                      {cat.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Main */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-900">
                {sp.categoryId ? categories.find((c) => c.id === sp.categoryId)?.name ?? "Products" : "All Products"}
              </h1>
              <span className="text-sm text-gray-500">{total} products</span>
            </div>

            {products.length === 0 ? (
              <div className="text-center py-20 text-gray-500">No products found</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {products.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-10">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <a key={p} href={`/shop?${new URLSearchParams({ ...sp, page: String(p) })}`}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${p === page ? "bg-blue-600 text-white" : "bg-white border border-gray-200 hover:bg-gray-50 text-gray-700"}`}>
                    {p}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
