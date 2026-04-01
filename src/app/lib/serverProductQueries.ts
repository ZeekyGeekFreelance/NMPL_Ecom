import type { ShopProductFiltersInput } from "@/app/(public)/shop/shopShared";
import prisma from "@/lib/db";
import { Product } from "@/app/types/productTypes";

export interface ProductConnectionPayload {
  products: Product[];
  hasMore: boolean;
  totalCount: number | null;
  isFallback: boolean;
}

const EMPTY_PRODUCT_CONNECTION: ProductConnectionPayload = {
  products: [],
  hasMore: false,
  totalCount: 0,
  isFallback: true,
};

const productInclude = {
  variants: { include: { attributes: { include: { attribute: true, value: true } } } },
  category: true,
  gst: true,
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
  gstId: p.gstId,
  category: p.category ? { id: p.category.id, name: p.category.name, slug: p.category.slug } : null,
  gst: p.gst ? { id: p.gst.id, name: p.gst.name, rate: p.gst.rate } : undefined,
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
      attributeId: a.attributeId,
      valueId: a.valueId,
      attribute: a.attribute,
      value: a.value,
    })),
  })),
});

export const fetchServerProductConnection = async (options: {
  first: number;
  skip?: number;
  filters?: ShopProductFiltersInput;
}): Promise<ProductConnectionPayload> => {
  try {
    const { first, skip = 0, filters } = options;
    const where: any = { isDeleted: false };

    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.isFeatured) where.isFeatured = true;
    if (filters?.isTrending) where.isTrending = true;
    if (filters?.isNew) where.isNew = true;
    if (filters?.isBestSeller) where.isBestSeller = true;
    if (filters?.search) where.name = { contains: filters.search, mode: "insensitive" };

    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({ where, include: productInclude, take: first, skip, orderBy: { createdAt: "desc" } }),
      prisma.product.count({ where }),
    ]);

    return {
      products: products.map(mapProduct),
      hasMore: skip + first < totalCount,
      totalCount,
      isFallback: false,
    };
  } catch (error) {
    console.error("[server-products] Failed to load product listing.", error);
    return { ...EMPTY_PRODUCT_CONNECTION };
  }
};

export const fetchServerProductBySlug = async (slug: string): Promise<Product | null> => {
  try {
    const product = await prisma.product.findUnique({
      where: { slug, isDeleted: false },
      include: productInclude,
    });
    return product ? mapProduct(product) : null;
  } catch (error) {
    console.error(`[server-products] Failed to load product ${slug}.`, error);
    return null;
  }
};
