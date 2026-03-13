import prisma from "@/infra/database/database.config";
import { ROLE } from "@prisma/client";
import { buildDateFilter } from "@/shared/utils/analytics";
import { CONFIRMED_ORDER_STATUS_VALUES } from "@/shared/utils/orderStatus";

export class AnalyticsRepository {
  async getOrderYearRange(): Promise<number[]> {
    const orders = await prisma.order.findMany({
      select: { orderDate: true },
      orderBy: { orderDate: "asc" },
      where: {
        status: {
          in: [...CONFIRMED_ORDER_STATUS_VALUES],
        },
      },
    });
    const years = [
      ...new Set(orders.map((order) => order.orderDate.getFullYear())),
    ];
    return years;
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
        status: {
          in: [...CONFIRMED_ORDER_STATUS_VALUES],
        },
      },
      include: {
        user: {
          include: {
            dealerProfile: {
              select: {
                status: true,
              },
            },
          },
        },
      },
    });
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
            status: {
              in: [...CONFIRMED_ORDER_STATUS_VALUES],
            },
          },
        },
      },
      include: {
        dealerProfile: {
          select: {
            status: true,
          },
        },
        orders: {
          where: {
            orderDate: orderDateFilter,
            status: {
              in: [...CONFIRMED_ORDER_STATUS_VALUES],
            },
          },
        },
      },
    });
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
