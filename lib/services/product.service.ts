import prisma from "@/lib/db";
import { AppError } from "@/lib/api";
import { v4 as uuidv4 } from "uuid";

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const PRODUCT_INCLUDE = {
  category: { select: { id: true, name: true, slug: true } },
  gst: { select: { id: true, name: true, rate: true } },
  variants: {
    include: {
      attributes: {
        include: {
          attribute: { select: { id: true, name: true, slug: true } },
          value: { select: { id: true, value: true, slug: true } },
        },
      },
    },
  },
} as const;

export async function getProducts(params: {
  search?: string;
  categoryId?: string;
  isFeatured?: boolean;
  isTrending?: boolean;
  isNew?: boolean;
  isBestSeller?: boolean;
  page?: number;
  limit?: number;
  userId?: string;
}) {
  const { search, categoryId, isFeatured, isTrending, isNew, isBestSeller, page = 1, limit = 20, userId } = params;

  const where: any = { isDeleted: false };
  if (search) where.name = { contains: search, mode: "insensitive" };
  if (categoryId) where.categoryId = categoryId;
  if (isFeatured !== undefined) where.isFeatured = isFeatured;
  if (isTrending !== undefined) where.isTrending = isTrending;
  if (isNew !== undefined) where.isNew = isNew;
  if (isBestSeller !== undefined) where.isBestSeller = isBestSeller;

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: PRODUCT_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  // Apply dealer pricing if userId provided
  if (userId) {
    const variantIds = products.flatMap((p) => p.variants.map((v) => v.id));
    if (variantIds.length > 0) {
      const dealerPrices = await prisma.dealerPriceMapping.findMany({
        where: { dealerId: userId, variantId: { in: variantIds } },
      });
      const priceMap = new Map(dealerPrices.map((dp) => [dp.variantId, dp.customPrice]));

      for (const product of products) {
        for (const variant of product.variants as any[]) {
          if (priceMap.has(variant.id)) {
            variant.price = priceMap.get(variant.id);
          }
        }
      }
    }
  }

  return { products, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getProductBySlug(slug: string, userId?: string) {
  const product = await prisma.product.findFirst({
    where: { slug, isDeleted: false },
    include: PRODUCT_INCLUDE,
  });
  if (!product) throw new AppError(404, "Product not found");

  if (userId) {
    const variantIds = product.variants.map((v) => v.id);
    const dealerPrices = await prisma.dealerPriceMapping.findMany({
      where: { dealerId: userId, variantId: { in: variantIds } },
    });
    const priceMap = new Map(dealerPrices.map((dp) => [dp.variantId, dp.customPrice]));
    for (const variant of product.variants as any[]) {
      if (priceMap.has(variant.id)) variant.price = priceMap.get(variant.id);
    }
  }

  return product;
}

export async function getProductById(id: string) {
  const product = await prisma.product.findFirst({
    where: { id, isDeleted: false },
    include: PRODUCT_INCLUDE,
  });
  if (!product) throw new AppError(404, "Product not found");
  return product;
}

export async function createProduct(data: {
  name: string;
  description?: string;
  categoryId?: string;
  gstId?: string;
  isFeatured?: boolean;
  isTrending?: boolean;
  isNew?: boolean;
  isBestSeller?: boolean;
  variants: Array<{
    sku: string;
    price: number;
    stock: number;
    images?: string[];
    defaultDealerPrice?: number;
    attributes?: Array<{ attributeId: string; valueId: string }>;
  }>;
}) {
  const slug = slugify(data.name);
  const existing = await prisma.product.findFirst({ where: { OR: [{ name: data.name }, { slug }] } });
  if (existing) throw new AppError(409, "Product with this name already exists");

  return prisma.product.create({
    data: {
      id: uuidv4(),
      name: data.name,
      slug,
      description: data.description,
      categoryId: data.categoryId,
      gstId: data.gstId,
      isFeatured: data.isFeatured ?? false,
      isTrending: data.isTrending ?? false,
      isNew: data.isNew ?? false,
      isBestSeller: data.isBestSeller ?? false,
      variants: {
        create: data.variants.map((v) => ({
          id: uuidv4(),
          sku: v.sku,
          price: v.price,
          stock: v.stock,
          images: v.images ?? [],
          defaultDealerPrice: v.defaultDealerPrice,
          attributes: v.attributes?.length
            ? {
                create: v.attributes.map((a) => ({
                  id: uuidv4(),
                  attributeId: a.attributeId,
                  valueId: a.valueId,
                })),
              }
            : undefined,
        })),
      },
    },
    include: PRODUCT_INCLUDE,
  });
}

export async function updateProduct(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    categoryId: string;
    gstId: string;
    isFeatured: boolean;
    isTrending: boolean;
    isNew: boolean;
    isBestSeller: boolean;
  }>
) {
  const product = await prisma.product.findFirst({ where: { id, isDeleted: false } });
  if (!product) throw new AppError(404, "Product not found");

  const updateData: any = { ...data };
  if (data.name && data.name !== product.name) {
    updateData.slug = slugify(data.name);
  }

  return prisma.product.update({ where: { id }, data: updateData, include: PRODUCT_INCLUDE });
}

export async function softDeleteProduct(id: string) {
  const product = await prisma.product.findFirst({ where: { id, isDeleted: false } });
  if (!product) throw new AppError(404, "Product not found");

  return prisma.product.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  });
}
