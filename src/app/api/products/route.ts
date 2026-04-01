import { NextRequest } from "next/server";
import { z } from "zod";
import { getProducts, createProduct } from "@/lib/services/product.service";
import { requireAuth } from "@/lib/auth/guard";
import { ok, created, handleError, validationError } from "@/lib/api";
import { getSessionFromRequest } from "@/lib/auth/session";

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  gstId: z.string().optional(),
  isFeatured: z.boolean().optional(),
  isTrending: z.boolean().optional(),
  isNew: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  variants: z.array(z.object({
    sku: z.string().min(1),
    price: z.number().positive(),
    stock: z.number().int().min(0),
    images: z.array(z.string()).optional(),
    defaultDealerPrice: z.number().positive().optional(),
    attributes: z.array(z.object({ attributeId: z.string(), valueId: z.string() })).optional(),
  })).min(1),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const session = await getSessionFromRequest(req);

    const result = await getProducts({
      search: searchParams.get("search") ?? undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
      isFeatured: searchParams.get("isFeatured") === "true" ? true : undefined,
      isTrending: searchParams.get("isTrending") === "true" ? true : undefined,
      isNew: searchParams.get("isNew") === "true" ? true : undefined,
      isBestSeller: searchParams.get("isBestSeller") === "true" ? true : undefined,
      page: Number(searchParams.get("page") ?? 1),
      limit: Number(searchParams.get("limit") ?? 20),
      userId: session?.role === "DEALER" ? session.sub : undefined,
    });

    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session, response } = await requireAuth(req, "ADMIN");
    if (!session) return response;

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const product = await createProduct(parsed.data);
    return created(product);
  } catch (err) {
    return handleError(err);
  }
}
