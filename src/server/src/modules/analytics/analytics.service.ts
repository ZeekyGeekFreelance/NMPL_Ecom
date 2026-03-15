import { endOfYear, startOfYear, subDays, subMonths, subYears } from "date-fns";
import { AnalyticsRepository } from "./analytics.repository";
import {
  DateRangeQuery,
  AnalyticsOverview,
  ProductPerformance,
  UserAnalytics,
} from "./analytics.types";
import {
  aggregateInteractionTrends,
  aggregateMonthlyTrends,
  calculateChanges,
  calculateEngagementScores,
  calculateRetentionRate,
  generateTopCustomers,
} from "@/shared/utils/analytics";

type ResolvedDateRange = {
  currentStartDate?: Date;
  currentEndDate?: Date;
  previousStartDate?: Date;
  previousEndDate?: Date;
  yearStart?: Date;
  yearEnd?: Date;
};

export class AnalyticsService {
  constructor(private analyticsRepository: AnalyticsRepository) {}

  async createInteraction(data: {
    userId?: string;
    sessionId?: string;
    productId?: string;
    type: string;
    performedBy?: string;
  }) {
    return this.analyticsRepository.createInteraction({
      userId: data.userId,
      sessionId: data.sessionId,
      productId: data.productId,
      type: data.type,
    });
  }

  async createInteractionsBulk(
    rows: Array<{
      userId?: string;
      sessionId?: string;
      productId?: string;
      type: string;
    }>
  ) {
    return this.analyticsRepository.createInteractionsBulk(rows);
  }

  private round(value: number): number {
    return Number(value.toFixed(2));
  }

  private roundNullable(value: number | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    return this.round(value);
  }

  private shouldComparePreviousPeriod(range: ResolvedDateRange): boolean {
    return Boolean(range.previousStartDate && range.previousEndDate);
  }

  private resolveDateRange(query: DateRangeQuery): ResolvedDateRange {
    const now = new Date();
    let currentStartDate: Date | undefined;
    let currentEndDate: Date | undefined = now;
    let previousStartDate: Date | undefined;
    let previousEndDate: Date | undefined;
    let yearStart: Date | undefined;
    let yearEnd: Date | undefined;

    if (query.year !== undefined) {
      if (
        !Number.isInteger(query.year) ||
        query.year < 1900 ||
        query.year > now.getFullYear()
      ) {
        throw new Error("Invalid year range.");
      }

      yearStart = startOfYear(new Date(query.year, 0, 1));
      yearEnd = endOfYear(new Date(query.year, 0, 1));
    }

    if (query.startDate || query.endDate) {
      if (!query.startDate || !query.endDate) {
        throw new Error("Both startDate and endDate must be provided.");
      }

      if (query.startDate > query.endDate) {
        throw new Error("startDate must be before endDate.");
      }

      currentStartDate = query.startDate;
      currentEndDate = query.endDate;
      previousStartDate = undefined;
      previousEndDate = undefined;
    } else {
      switch (query.timePeriod) {
        case "last7days":
          currentStartDate = subDays(now, 7);
          previousStartDate = subDays(now, 14);
          previousEndDate = subDays(now, 7);
          break;
        case "lastMonth":
          currentStartDate = subMonths(now, 1);
          previousStartDate = subMonths(now, 2);
          previousEndDate = subMonths(now, 1);
          break;
        case "lastYear":
          currentStartDate = subYears(now, 1);
          previousStartDate = subYears(now, 2);
          previousEndDate = subYears(now, 1);
          break;
        case "allTime":
        case undefined:
          currentStartDate = undefined;
          currentEndDate = undefined;
          previousStartDate = undefined;
          previousEndDate = undefined;
          break;
        case "custom":
          throw new Error("Custom range requires startDate and endDate.");
        default:
          throw new Error("Invalid timePeriod");
      }
    }

    return {
      currentStartDate,
      currentEndDate,
      previousStartDate,
      previousEndDate,
      yearStart,
      yearEnd,
    };
  }

  async getAnalyticsOverview(query: DateRangeQuery): Promise<AnalyticsOverview> {
    const range = this.resolveDateRange(query);
    const shouldCompare = this.shouldComparePreviousPeriod(range);

    const [currentMetrics, currentUserMetrics] = await Promise.all([
      this.analyticsRepository.getOrderMetricsAggregated(
        range.currentStartDate,
        range.currentEndDate,
        range.yearStart,
        range.yearEnd
      ),
      this.analyticsRepository.getUserMetricsAggregated(
        range.currentStartDate,
        range.currentEndDate,
        range.yearStart,
        range.yearEnd
      ),
    ]);

    const [previousMetrics, previousUserMetrics] = shouldCompare
      ? await Promise.all([
          this.analyticsRepository.getOrderMetricsAggregated(
            range.previousStartDate,
            range.previousEndDate,
            range.yearStart,
            range.yearEnd
          ),
          this.analyticsRepository.getUserMetricsAggregated(
            range.previousStartDate,
            range.previousEndDate,
            range.yearStart,
            range.yearEnd
          ),
        ])
      : [
          { totalOrders: 0, totalRevenue: 0, totalSales: 0, averageOrderValue: 0 },
          { totalUsers: 0, repeatUsers: 0, totalRevenue: 0 },
        ];

    const changes = calculateChanges(
      { totalRevenue: currentMetrics.totalRevenue, totalOrders: currentMetrics.totalOrders, totalSales: currentMetrics.totalSales, totalUsers: currentUserMetrics.totalUsers, averageOrderValue: currentMetrics.averageOrderValue },
      { totalRevenue: previousMetrics.totalRevenue, totalOrders: previousMetrics.totalOrders, totalSales: previousMetrics.totalSales, totalUsers: previousUserMetrics.totalUsers, averageOrderValue: previousMetrics.averageOrderValue },
      shouldCompare
    );

    const trendStartDate = range.yearStart ?? range.currentStartDate;
    const trendEndDate = range.yearEnd ?? range.currentEndDate;
    const [trendOrders, trendOrderItems] = await Promise.all([
      this.analyticsRepository.getOrdersByTimePeriod(trendStartDate, trendEndDate),
      this.analyticsRepository.getOrderItemsByTimePeriod(trendStartDate, trendEndDate),
    ]);
    const monthlyTrends = aggregateMonthlyTrends(trendOrders, trendOrderItems, []);

    return {
      totalRevenue: this.round(currentMetrics.totalRevenue),
      totalOrders: currentMetrics.totalOrders,
      totalSales: currentMetrics.totalSales,
      totalUsers: currentUserMetrics.totalUsers,
      averageOrderValue: this.round(currentMetrics.averageOrderValue),
      changes: {
        revenue: this.roundNullable(changes.revenue),
        orders: this.roundNullable(changes.orders),
        sales: this.roundNullable(changes.sales),
        users: this.roundNullable(changes.users),
        averageOrderValue: this.roundNullable(changes.averageOrderValue),
      },
      monthlyTrends,
    };
  }

  async getProductPerformance(query: DateRangeQuery): Promise<ProductPerformance[]> {
    const range = this.resolveDateRange(query);
    const rows = await this.analyticsRepository.getProductPerformanceAggregated(
      range.currentStartDate,
      range.currentEndDate,
      range.yearStart,
      range.yearEnd,
      query.category
    );

    // Merge variants that belong to the same product
    const byProduct = new Map<string, ProductPerformance>();
    for (const row of rows) {
      const existing = byProduct.get(row.productId);
      if (existing) {
        existing.quantity += row.totalQuantity;
        existing.revenue = Number((existing.revenue + row.totalRevenue).toFixed(2));
      } else {
        byProduct.set(row.productId, {
          id: row.productId,
          sku: row.sku,
          name: row.productName,
          quantity: row.totalQuantity,
          revenue: row.totalRevenue,
        });
      }
    }

    return [...byProduct.values()].sort((a, b) => b.quantity - a.quantity);
  }

  async getUserAnalytics(query: DateRangeQuery): Promise<UserAnalytics> {
    const range = this.resolveDateRange(query);
    const shouldCompare = this.shouldComparePreviousPeriod(range);

    const [userMetrics, interactions] = await Promise.all([
      this.analyticsRepository.getUserMetricsAggregated(
        range.currentStartDate,
        range.currentEndDate,
        range.yearStart,
        range.yearEnd
      ),
      this.analyticsRepository.getInteractionsByTimePeriod(
        range.currentStartDate,
        range.currentEndDate,
        range.yearStart,
        range.yearEnd
      ),
    ]);

    const previousUserMetrics = shouldCompare
      ? await this.analyticsRepository.getUserMetricsAggregated(
          range.previousStartDate,
          range.previousEndDate,
          range.yearStart,
          range.yearEnd
        )
      : { totalUsers: 0, repeatUsers: 0, totalRevenue: 0 };

    const lifetimeValue = userMetrics.totalUsers > 0
      ? userMetrics.totalRevenue / userMetrics.totalUsers
      : 0;
    const repeatPurchaseRate = userMetrics.totalUsers > 0
      ? (userMetrics.repeatUsers / userMetrics.totalUsers) * 100
      : 0;
    const retentionRate = shouldCompare
      ? calculateRetentionRate(
          Array(userMetrics.totalUsers).fill({}),
          Array(previousUserMetrics.totalUsers).fill({})
        )
      : 0;

    const { scores: engagementScores, averageScore: engagementScore } =
      calculateEngagementScores(interactions);
    const topUsers = generateTopCustomers([], engagementScores);
    const interactionTrends = aggregateInteractionTrends(interactions);
    const changes = calculateChanges(
      { totalUsers: userMetrics.totalUsers },
      { totalUsers: previousUserMetrics.totalUsers },
      shouldCompare
    );

    return {
      totalUsers: userMetrics.totalUsers,
      totalRevenue: this.round(userMetrics.totalRevenue),
      retentionRate: this.round(retentionRate),
      lifetimeValue: this.round(lifetimeValue),
      repeatPurchaseRate: this.round(repeatPurchaseRate),
      engagementScore: this.round(engagementScore),
      changes: {
        users: this.roundNullable(changes.users),
      },
      topUsers,
      interactionTrends,
    };
  }

  async getYearRange(): Promise<{ minYear: number; maxYear: number }> {
    const years = await this.analyticsRepository.getOrderYearRange();
    const currentYear = new Date().getFullYear();

    if (!years.length) {
      return {
        minYear: currentYear,
        maxYear: currentYear,
      };
    }

    return {
      minYear: Math.min(...years),
      maxYear: Math.max(...years),
    };
  }
}
