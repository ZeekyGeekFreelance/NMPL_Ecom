import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ok, handleError } from "@/lib/api";
import { startOfDay, subDays, startOfMonth, endOfMonth } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const { session, response } = await requireAuth(req, "ADMIN");
    if (!session) return response;

    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const [totalOrders, monthOrders, totalRevenue, monthRevenue, totalUsers, totalProducts, lowStockVariants] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } }),
      prisma.order.aggregate({ _sum: { amount: true }, where: { status: { not: "QUOTATION_REJECTED" } } }),
      prisma.order.aggregate({ _sum: { amount: true }, where: { createdAt: { gte: monthStart, lte: monthEnd } } }),
      prisma.user.count(),
      prisma.product.count({ where: { isDeleted: false } }),
      prisma.productVariant.count({ where: { stock: { lte: prisma.productVariant.fields.lowStockThreshold } } }).catch(() => 0),
    ]);

    // Orders by day for last 30 days
    const recentOrders = await prisma.order.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, amount: true },
      orderBy: { createdAt: "asc" },
    });

    return ok({
      summary: {
        totalOrders,
        monthOrders,
        totalRevenue: totalRevenue._sum.amount ?? 0,
        monthRevenue: monthRevenue._sum.amount ?? 0,
        totalUsers,
        totalProducts,
      },
      recentOrders,
    });
  } catch (err) {
    return handleError(err);
  }
}
