import prisma from "@/infra/database/database.config";
import { ROLE } from "@prisma/client";
import { buildDateFilter } from "@/shared/utils/analytics";
import { CONFIRMED_ORDER_STATUS_VALUES } from "@/shared/utils/orderStatus";

export class AnalyticsRepository {
  async getOrderYearRange(): Promise<number[]> {
    const result = await prisma.$queryRaw<{ year: number }[]>`
      SELECT DISTINCT EXTRACT(YEAR FROM "orderDate")::int AS year
      FROM "public"."Order"
      WHERE status = ANY(${[...CONFIRMED_ORDER_STATUS_VALUES]}::text[])
      ORDER BY year ASC
    `;
    return result.map((row) => row.year);
  }

  async getOrdersByTimePeriod(
    start?: Date,
    end?: Date,
    yearStart?: Date,
    yearEnd?: Date
  ) {
    return prisma.order.findMany({
      where: {
        orderDate: buildDateFilter(start, end, yearStart, yearEnd),
        status: { in: [...CONFIRMED_ORDER_STATUS_VALUES] },
      },
      include: {
        user: {
          include: {
            dealerProfile: { select: { status: true } },
          },
        },
      },
    });
  }

  async getOrderMetricsAggregated(
    start?: Date,
    end?: Date,
    yearStart?: Date,
    yearEnd?: Date
  ): Promise<{ totalOrders: number; totalRevenue: number; totalSales: number; averageOrderValue: number }> {
    const dateFilter = buildDateFilter(start, end, yearStart, yearEnd);
    const where = {
      orderDate: dateFilter,
      status: { in: [...CONFIRMED_ORDER_STATUS_VALUES] },
    };

    const [orderAgg, itemAgg] = await Promise.all([
      prisma.order.aggregate({
        where,
        _count: { _all: true },
        _sum: { amount: true },
        _avg: { amount: true },
      }),
      prisma.orderItem.aggregate({
        where: { order: where },
        _sum: { quantity: true },
      }),
    ]);

    return {
      totalOrders: orderAgg._count._all,
      totalRevenue: orderAgg._sum.amount ?? 0,
      totalSales: itemAgg._sum.quantity ?? 0,
      averageOrderValue: orderAgg._avg.amount ?? 0,
    };
  }

  async getOrderItemsByTimePeriod(
    start?: Date,
    end?: Date,
    yearStart?: Date,
    yearEnd?: Date,
    category?: string
  ) {
    const orderDateFilter = buildDateFilter(start, end, yearStart, yearEnd);

    return prisma.orderItem.findMany({
      where: {
        order: {
          orderDate: orderDateFilter,
          status: {
            in: [...CONFIRMED_ORDER_STATUS_VALUES],
          },
        },
        ...(category && {
          variant: {
            product: {
              category: {
                name: category,
              },
            },
          },
        }),
      },
      include: {
        order: {
          select: {
            orderDate: true,
          },
        },
        variant: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });
  }

  async getProductPerformanceAggregated(
    start?: Date,
    end?: Date,
    yearStart?: Date,
    yearEnd?: Date,
    category?: string
  ): Promise<Array<{ productId: string; productName: string; sku: string; totalQuantity: number; totalRevenue: number }>> {
    const orderDateFilter = buildDateFilter(start, end, yearStart, yearEnd);

    const grouped = await prisma.orderItem.groupBy({
      by: ["variantId"],
      where: {
        order: {
          orderDate: orderDateFilter,
          status: { in: [...CONFIRMED_ORDER_STATUS_VALUES] },
        },
        ...(category && {
          variant: { product: { category: { name: category } } },
        }),
      },
      _sum: { quantity: true },
      _count: { _all: true },
      orderBy: { _sum: { quantity: "desc" } },
    });

    if (!grouped.length) return [];

    const variantIds = grouped.map((row) => row.variantId);
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: {
        id: true,
        sku: true,
        price: true,
        product: { select: { id: true, name: true } },
      },
    });

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    return grouped.map((row) => {
      const variant = variantMap.get(row.variantId);
      const qty = row._sum.quantity ?? 0;
      return {
        productId: variant?.product?.id ?? row.variantId,
        productName: variant?.product?.name ?? "Unknown",
        sku: variant?.sku ?? "N/A",
        totalQuantity: qty,
        totalRevenue: Number(((variant?.price ?? 0) * qty).toFixed(2)),
      };
    });
  }

  async getUsersByTimePeriod(
    start?: Date,
    end?: Date,
    yearStart?: Date,
    yearEnd?: Date
  ) {
    const orderDateFilter = buildDateFilter(start, end, yearStart, yearEnd);

    return prisma.user.findMany({
      where: {
        role: ROLE.USER,
        orders: {
          some: {
            orderDate: orderDateFilter,
            status: { in: [...CONFIRMED_ORDER_STATUS_VALUES] },
          },
        },
      },
      include: {
        dealerProfile: { select: { status: true } },
        orders: {
          where: {
            orderDate: orderDateFilter,
            status: { in: [...CONFIRMED_ORDER_STATUS_VALUES] },
          },
        },
      },
    });
  }

  async getUserMetricsAggregated(
    start?: Date,
    end?: Date,
    yearStart?: Date,
    yearEnd?: Date
  ): Promise<{ totalUsers: number; repeatUsers: number; totalRevenue: number }> {
    const orderDateFilter = buildDateFilter(start, end, yearStart, yearEnd);
    const orderWhere = {
      orderDate: orderDateFilter,
      status: { in: [...CONFIRMED_ORDER_STATUS_VALUES] },
    };

    // Count distinct users who placed at least one confirmed order in the period
    const grouped = await prisma.order.groupBy({
      by: ["userId"],
      where: orderWhere,
      _count: { _all: true },
      _sum: { amount: true },
    });

    const totalUsers = grouped.length;
    const repeatUsers = grouped.filter((row) => row._count._all > 1).length;
    const totalRevenue = grouped.reduce((sum, row) => sum + (row._sum.amount ?? 0), 0);

    return { totalUsers, repeatUsers, totalRevenue };
  }
  async getInteractionsByTimePeriod(
    start?: Date,
    end?: Date,
    yearStart?: Date,
    yearEnd?: Date
  ) {
    return prisma.interaction.findMany({
      where: {
        createdAt: buildDateFilter(start, end, yearStart, yearEnd),
      },
      include: { user: true, product: true },
    });
  }
  async createInteraction(data: {
    userId?: string;
    sessionId?: string;
    productId?: string;
    type: string;
  }) {
    return prisma.interaction.create({
      data: {
        userId: data.userId,
        sessionId: data.sessionId,
        productId: data.productId,
        type: data.type,
      },
    });
  }

  async createInteractionsBulk(
    data: Array<{
      userId?: string;
      sessionId?: string;
      productId?: string;
      type: string;
    }>
  ) {
    if (!data.length) {
      return { count: 0 };
    }

    return prisma.interaction.createMany({
      data,
    });
  }
}
