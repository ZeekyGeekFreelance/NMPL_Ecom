import {
  calculateMetrics,
  fetchData,
  getDateRange,
  shouldFetchPreviousPeriod,
  calculateChanges,
  aggregateMonthlyTrends,
  buildDateFilter,
} from "@/shared/utils/analytics";
import { Context } from "../resolver";
import { CONFIRMED_ORDER_STATUS_VALUES } from "@/shared/utils/orderStatus";

const revenueAnalytics = {
  Query: {
    revenueAnalytics: async (_: any, { params }: any, { prisma }: Context) => {
      const { timePeriod, year, startDate, endDate } = params;
      const {
        currentStartDate,
        previousStartDate,
        previousEndDate,
        yearStart,
        yearEnd,
      } = getDateRange({ timePeriod, year, startDate, endDate });
      const currentOrderDateFilter = buildDateFilter(
        currentStartDate,
        endDate,
        yearStart,
        yearEnd
      );

      const currentOrders = await fetchData(
        prisma,
        "order",
        "orderDate",
        currentStartDate,
        endDate,
        yearStart,
        yearEnd,
        undefined,
        undefined,
        {
          status: {
            in: [...CONFIRMED_ORDER_STATUS_VALUES],
          },
        }
      );
      const currentOrderItems = await prisma.orderItem.findMany({
        where: {
          order: {
            orderDate: currentOrderDateFilter,
            status: {
              in: [...CONFIRMED_ORDER_STATUS_VALUES],
            },
          },
        },
        include: {
          variant: true,
          order: {
            select: {
              orderDate: true,
            },
          },
        },
      });

      const fetchPrevious = shouldFetchPreviousPeriod(timePeriod);
      const previousOrderDateFilter = buildDateFilter(
        previousStartDate,
        previousEndDate,
        yearStart,
        yearEnd
      );
      const previousOrders = fetchPrevious
        ? await fetchData(
            prisma,
            "order",
            "orderDate",
            previousStartDate,
            previousEndDate,
            yearStart,
            yearEnd,
            undefined,
            undefined,
            {
              status: {
                in: [...CONFIRMED_ORDER_STATUS_VALUES],
              },
            }
          )
        : [];
      const previousOrderItems = fetchPrevious
        ? await prisma.orderItem.findMany({
            where: {
              order: {
                orderDate: previousOrderDateFilter,
                status: {
                  in: [...CONFIRMED_ORDER_STATUS_VALUES],
                },
              },
            },
            include: {
              variant: true,
              order: {
                select: {
                  orderDate: true,
                },
              },
            },
          })
        : [];

      const currentMetrics = calculateMetrics(currentOrders, currentOrderItems, []);
      const previousMetrics = calculateMetrics(previousOrders, previousOrderItems, []);

      const changes = calculateChanges(currentMetrics, previousMetrics, fetchPrevious);

      const trendStartDate = yearStart ?? currentStartDate;
      const trendEndDate = yearEnd ?? (endDate ? new Date(endDate) : undefined);

      const ordersForTrends = await fetchData(
        prisma,
        "order",
        "orderDate",
        trendStartDate,
        trendEndDate,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          status: {
            in: [...CONFIRMED_ORDER_STATUS_VALUES],
          },
        }
      );
      const trendOrderDateFilter = buildDateFilter(
        trendStartDate,
        trendEndDate,
        undefined,
        undefined
      );
      const orderItemsForTrends = await prisma.orderItem.findMany({
        where: {
          order: {
            orderDate: trendOrderDateFilter,
            status: {
              in: [...CONFIRMED_ORDER_STATUS_VALUES],
            },
          },
        },
        include: {
          order: {
            select: {
              orderDate: true,
            },
          },
        },
      });

      const monthlyTrends = aggregateMonthlyTrends(
        ordersForTrends,
        orderItemsForTrends,
        []
      );

      return {
        totalRevenue: Number(currentMetrics.totalRevenue.toFixed(2)),
        changes: {
          revenue: changes.revenue,
        },
        monthlyTrends,
      };
    },
  },
};

export default revenueAnalytics;
