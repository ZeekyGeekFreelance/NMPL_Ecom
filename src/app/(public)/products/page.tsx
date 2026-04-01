import { MainLayout } from "@/app/components/layout/MainLayout";
import prisma from "@/lib/db";
import { ProductCard } from "@/app/components/ui/ProductCard";
export default async function ProductsPage() {
  const products = await prisma.product.findMany({ where: { isDeleted: false }, include: { variants: true, category: true }, orderBy: { createdAt: "desc" }, take: 40 }).catch(() => []);
  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">All Products</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </div>
    </MainLayout>
  );
}
