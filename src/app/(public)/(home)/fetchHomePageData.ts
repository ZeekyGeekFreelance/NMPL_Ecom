import prisma from "@/lib/db";
import { Product } from "@/app/types/productTypes";

const SECTION_PAGE_SIZE = 12;

export interface HomePageData {
  featured: Product[];
  trending: Product[];
  newArrivals: Product[];
  bestSellers: Product[];
  categories: { id: string; slug: string; name: string; description?: string }[];
  isFallback: boolean;
}

const EMPTY_HOME_PAGE_DATA: HomePageData = {
  featured: [],
  trending: [],
  newArrivals: [],
  bestSellers: [],
  categories: [],
  isFallback: true,
};

const mapProduct = (p: any): Product => ({
  id: p.id,
  name: p.name,
  slug: p.slug,
  description: p.description,
  isNew: p.isNew,
  isTrending: p.isTrending,
  isBestSeller: p.isBestSeller,
  isFeatured: p.isFeatured,
  salesCount: p.salesCount ?? 0,
  categoryId: p.categoryId,
  category: p.category
    ? { id: p.category.id, name: p.category.name, slug: p.category.slug }
    : null,
  variants: (p.variants ?? []).map((v: any) => ({
    id: v.id,
    sku: v.sku,
    price: v.price,
    defaultDealerPrice: v.defaultDealerPrice ?? null,
    stock: v.stock,
    lowStockThreshold: v.lowStockThreshold,
    barcode: v.barcode ?? "",
    images: v.images ?? [],
    attributes: (v.attributes ?? []).map((a: any) => ({
      attributeId: a.attributeId ?? a.attribute?.id,
      valueId: a.valueId ?? a.value?.id,
      attribute: a.attribute,
      value: a.value,
    })),
  })),
});

/**
 * Fetches all home page data using direct Prisma queries during SSR.
 */
export const fetchHomePageData = async (): Promise<HomePageData> => {
  try {
    const include = {
      variants: { include: { attributes: { include: { attribute: true, value: true } } } },
      category: true,
    };
    const baseWhere = { isDeleted: false };

    const [featured, trending, newArrivals, bestSellers, categories] = await Promise.all([
      prisma.product.findMany({ where: { ...baseWhere, isFeatured: true }, include, take: SECTION_PAGE_SIZE, orderBy: { createdAt: "desc" } }),
      prisma.product.findMany({ where: { ...baseWhere, isTrending: true }, include, take: SECTION_PAGE_SIZE, orderBy: { createdAt: "desc" } }),
      prisma.product.findMany({ where: { ...baseWhere, isNew: true }, include, take: SECTION_PAGE_SIZE, orderBy: { createdAt: "desc" } }),
      prisma.product.findMany({ where: { ...baseWhere, isBestSeller: true }, include, take: SECTION_PAGE_SIZE, orderBy: { createdAt: "desc" } }),
      prisma.category.findMany({ where: {}, orderBy: { name: "asc" } }),
    ]);

    return {
      featured: featured.map(mapProduct),
      trending: trending.map(mapProduct),
      newArrivals: newArrivals.map(mapProduct),
      bestSellers: bestSellers.map(mapProduct),
      categories: categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name, description: c.description ?? undefined })),
      isFallback: false,
    };
  } catch (error) {
    console.error("[home-data] Failed to load home page data.", error);
    return { ...EMPTY_HOME_PAGE_DATA };
  }
};
