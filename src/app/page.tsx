import { MainLayout } from "./components/layout/MainLayout";
import prisma from "@/lib/db";
import { ProductCard } from "./components/ui/ProductCard";
import Link from "next/link";

async function getHomeData() {
  try {
    const [featured, trending, newArrivals, bestSellers, categories] = await Promise.all([
      prisma.product.findMany({ where: { isFeatured: true, isDeleted: false }, take: 8, include: { variants: true, category: true } }),
      prisma.product.findMany({ where: { isTrending: true, isDeleted: false }, take: 8, include: { variants: true, category: true } }),
      prisma.product.findMany({ where: { isNew: true, isDeleted: false }, take: 8, include: { variants: true, category: true } }),
      prisma.product.findMany({ where: { isBestSeller: true, isDeleted: false }, take: 8, include: { variants: true, category: true } }),
      prisma.category.findMany({ take: 8, orderBy: { createdAt: "desc" } }),
    ]);
    return { featured, trending, newArrivals, bestSellers, categories };
  } catch {
    return { featured: [], trending: [], newArrivals: [], bestSellers: [], categories: [] };
  }
}

export default async function HomePage() {
  const { featured, trending, newArrivals, bestSellers, categories } = await getHomeData();

  return (
    <MainLayout>
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            {process.env.NEXT_PUBLIC_PLATFORM_NAME ?? "NMPL"}
          </h1>
          <p className="text-xl text-blue-100 mb-8">Quality products, delivered to your door</p>
          <Link href="/shop" className="bg-white text-blue-700 px-8 py-3 rounded-full font-semibold text-lg hover:bg-blue-50 transition-colors inline-block">
            Shop Now
          </Link>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">Shop by Category</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <Link key={cat.id} href={`/shop?categoryId=${cat.id}`} className="bg-gray-50 rounded-xl p-6 text-center hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-all">
                <div className="font-semibold text-gray-800">{cat.name}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <ProductSection title="Featured Products" products={featured} emptyHref="/products" />
      <ProductSection title="Trending Now" products={trending} emptyHref="/products?isTrending=true" />
      <ProductSection title="New Arrivals" products={newArrivals} emptyHref="/products?isNew=true" />
      <ProductSection title="Best Sellers" products={bestSellers} emptyHref="/products?isBestSeller=true" />

      {/* Store highlights */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {[
            { icon: "🚚", title: "Fast Delivery", desc: "Swift delivery to your doorstep" },
            { icon: "🛡️", title: "Secure Payments", desc: "100% safe and encrypted transactions" },
            { icon: "↩️", title: "Easy Returns", desc: "Hassle-free return policy" },
          ].map((item) => (
            <div key={item.title} className="p-6">
              <div className="text-4xl mb-3">{item.icon}</div>
              <h3 className="font-bold text-lg text-gray-900 mb-2">{item.title}</h3>
              <p className="text-gray-600 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </MainLayout>
  );
}

function ProductSection({ title, products, emptyHref }: { title: string; products: any[]; emptyHref: string }) {
  if (products.length === 0) return null;
  return (
    <section className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <Link href={emptyHref} className="text-blue-600 hover:text-blue-700 text-sm font-medium">View all →</Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}
