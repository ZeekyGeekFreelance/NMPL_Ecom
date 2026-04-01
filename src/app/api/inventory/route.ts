import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ok, handleError, validationError } from "@/lib/api";
import { v4 as uuidv4 } from "uuid";

export async function GET(req: NextRequest) {
  try {
    const { session, response } = await requireAuth(req, "ADMIN");
    if (!session) return response;
    const { searchParams } = req.nextUrl;
    const page = Number(searchParams.get("page") ?? 1);
    const limit = Number(searchParams.get("limit") ?? 20);
    const variants = await prisma.productVariant.findMany({
      where: { product: { isDeleted: false } },
      include: { product: { select: { name: true, slug: true } } },
      orderBy: { stock: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    });
    return ok(variants);
  } catch (err) {
    return handleError(err);
  }
}

const restockSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { session, response } = await requireAuth(req, "ADMIN");
    if (!session) return response;
    const body = await req.json();
    const parsed = restockSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { variantId, quantity, notes } = parsed.data;
    const [variant] = await prisma.$transaction([
      prisma.productVariant.update({
        where: { id: variantId },
        data: { stock: { increment: quantity } },
      }),
      prisma.restock.create({
        data: { id: uuidv4(), variantId, quantity, notes, userId: session.sub },
      }),
      prisma.stockMovement.create({
        data: { id: uuidv4(), variantId, quantity, reason: "restock", userId: session.sub },
      }),
    ]);
    return ok(variant);
  } catch (err) {
    return handleError(err);
  }
}
