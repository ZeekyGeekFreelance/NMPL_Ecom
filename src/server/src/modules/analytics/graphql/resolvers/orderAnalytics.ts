import {
  calculateMetrics,
  fetchData,
  getDateRange,
  shouldFetchPreviousPeriod,
  calculateChanges,
  buildDateFilter,
} from "@/shared/utils/analytics";
import { Context } from "../resolver";
import { REJECTED_ORDER_STATUS_VALUES } from "@/shared/utils/orderStatus";

const orderAnalytics = {
  Query: {
    orderAnalytics: async (_: any, { params }: any, { prisma }: Context) => {
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
            notIn: [...REJECTED_ORDER_STATUS_VALUES],
          },
        }
      );
      const currentOrderItems = await prisma.orderItem.findMany({
        where: {
          order: {
            orderDate: currentOrderDateFilter,
            status: {
              notIn: [...REJECTED_ORDER_STATUS_VALUES],
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
                notIn: [...REJECTED_ORDER_STATUS_VALUES],
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
                  notIn: [...REJECTED_ORDER_STATUS_VALUES],
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

      return {
        totalOrders: currentMetrics.totalOrders,
        totalSales: currentMetrics.totalSales,
        averageOrderValue: Number(currentMetrics.averageOrderValue.toFixed(2)),
        changes: {
          orders: changes.orders,
          sales: changes.sales,
          averageOrderValue: changes.averageOrderValue,
        },
      };
    },
  },
};

export default orderAnalytics;
