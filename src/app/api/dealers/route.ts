import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ok, handleError, validationError, notFound } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const { session, response } = await requireAuth(req, "ADMIN");
    if (!session) return response;
    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status") ?? undefined;
    const page = Number(searchParams.get("page") ?? 1);
    const limit = Number(searchParams.get("limit") ?? 20);
    const where: any = {};
    if (status) where.status = status;
    const [total, dealers] = await Promise.all([
      prisma.dealerProfile.count({ where }),
      prisma.dealerProfile.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return ok({ dealers, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    return handleError(err);
  }
}
