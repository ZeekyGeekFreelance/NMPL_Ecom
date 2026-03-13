import { Context } from "../resolver";
import { ROLE } from "@prisma/client";
import {
  fetchData,
  buildDateFilter,
  shouldFetchPreviousPeriod,
  calculateEngagementScores,
  calculateRetentionRate,
  calculateCustomerMetrics,
  generateTopCustomers,
  aggregateInteractionTrends,
  getDateRange,
  calculateChanges,
} from "@/shared/utils/analytics";
import { CONFIRMED_ORDER_STATUS_VALUES } from "@/shared/utils/orderStatus";

const userAnalytics = {
  Query: {
    userAnalytics: async (_: any, { params }: any, { prisma }: Context) => {
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
      const users = await prisma.user.findMany({
        where: {
          role: ROLE.USER,
          orders: {
            some: {
              orderDate: currentOrderDateFilter,
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
              orderDate: currentOrderDateFilter,
              status: {
                in: [...CONFIRMED_ORDER_STATUS_VALUES],
              },
            },
          },
        },
      });
      const interactions = await fetchData(
        prisma,
        "interaction",
        "createdAt",
        currentStartDate,
        endDate,
        yearStart,
        yearEnd
      );

      const fetchPrevious = shouldFetchPreviousPeriod(timePeriod);
      const previousUsers = fetchPrevious
        ? await prisma.user.findMany({
            where: {
              role: ROLE.USER,
              orders: {
                some: {
                  orderDate: buildDateFilter(
                    previousStartDate,
                    previousEndDate,
                    yearStart,
                    yearEnd
                  ),
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
                  orderDate: buildDateFilter(
                    previousStartDate,
                    previousEndDate,
                    yearStart,
                    yearEnd
                  ),
                  status: {
                    in: [...CONFIRMED_ORDER_STATUS_VALUES],
                  },
                },
              },
            },
          })
        : [];

      const {
        totalCustomers: totalUsers,
        totalRevenue,
        lifetimeValue,
        repeatPurchaseRate,
      } = calculateCustomerMetrics(users);
      const previousMetrics = fetchPrevious
        ? calculateCustomerMetrics(previousUsers)
        : { totalCustomers: 0 };

      const retentionRate = fetchPrevious
        ? calculateRetentionRate(users, previousUsers)
        : 0;

      const { scores: engagementScores, averageScore: engagementScore } =
        calculateEngagementScores(interactions);

      const topUsers = generateTopCustomers(users, engagementScores);

      const interactionTrends = aggregateInteractionTrends(interactions);

      const changes = calculateChanges(
        { totalUsers },
        { totalUsers: previousMetrics.totalCustomers },
        fetchPrevious
      );

      return {
        totalUsers,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        retentionRate: Number(retentionRate.toFixed(2)),
        lifetimeValue: Number(lifetimeValue.toFixed(2)),
        repeatPurchaseRate: Number(repeatPurchaseRate.toFixed(2)),
        engagementScore: Number(engagementScore.toFixed(2)),
        topUsers,
        interactionTrends,
        changes: {
          users: Number(changes.users?.toFixed(2)) || 0,
        },
      };
    },
  },
};

export default userAnalytics;
