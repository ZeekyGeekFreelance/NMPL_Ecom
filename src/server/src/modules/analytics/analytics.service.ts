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
  calculateCustomerMetrics,
  calculateEngagementScores,
  calculateMetrics,
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

    const [orders, orderItems, users] = await Promise.all([
      this.analyticsRepository.getOrdersByTimePeriod(
        range.currentStartDate,
        range.currentEndDate,
        range.yearStart,
        range.yearEnd
      ),
      this.analyticsRepository.getOrderItemsByTimePeriod(
        range.currentStartDate,
        range.currentEndDate,
        range.yearStart,
        range.yearEnd
      ),
      this.analyticsRepository.getUsersByTimePeriod(
        range.currentStartDate,
        range.currentEndDate,
        range.yearStart,
        range.yearEnd
      ),
    ]);

    const currentMetrics = calculateMetrics(orders, orderItems, users);

    const [previousOrders, previousOrderItems, previousUsers] = shouldCompare
      ? await Promise.all([
          this.analyticsRepository.getOrdersByTimePeriod(
            range.previousStartDate,
            range.previousEndDate,
            range.yearStart,
            range.yearEnd
          ),
          this.analyticsRepository.getOrderItemsByTimePeriod(
            range.previousStartDate,
            range.previousEndDate,
            range.yearStart,
            range.yearEnd
          ),
          this.analyticsRepository.getUsersByTimePeriod(
            range.previousStartDate,
            range.previousEndDate,
            range.yearStart,
            range.yearEnd
          ),
        ])
      : [[], [], []];

    const previousMetrics = calculateMetrics(
      previousOrders,
      previousOrderItems,
      previousUsers
    );
    const changes = calculateChanges(currentMetrics, previousMetrics, shouldCompare);

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
      totalUsers: currentMetrics.totalUsers,
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
    const orderItems = await this.analyticsRepository.getOrderItemsByTimePeriod(
      range.currentStartDate,
      range.currentEndDate,
      range.yearStart,
      range.yearEnd,
      query.category
    );

    const productSales: Record<
      string,
      {
        id: string;
        name: string;
        sku: string;
        quantity: number;
        revenue: number;
        skuSales: Record<string, number>;
      }
    > = {};

    for (const item of orderItems) {
      const productId = item.variant.product?.id || item.variantId;
      const productName =
        item.variant.product?.name || item.variant.sku || "Unknown";
      const sku = item.variant.sku || "N/A";

      if (!productSales[productId]) {
        productSales[productId] = {
          id: productId,
          name: productName,
          sku,
          quantity: 0,
          revenue: 0,
          skuSales: {},
        };
      }

      productSales[productId].skuSales[sku] =
        (productSales[productId].skuSales[sku] || 0) + item.quantity;
      productSales[productId].quantity += item.quantity;
      productSales[productId].revenue += item.quantity * item.price;
    }

    return Object.values(productSales)
      .map((product) => {
        const topSku = Object.entries(product.skuSales).sort(
          (first, second) => second[1] - first[1]
        )[0]?.[0];

        return {
          id: product.id,
          sku: topSku || product.sku,
          name: product.name,
          quantity: product.quantity,
          revenue: this.round(product.revenue),
        };
      })
      .sort((first, second) => second.quantity - first.quantity);
  }

  async getUserAnalytics(query: DateRangeQuery): Promise<UserAnalytics> {
    const range = this.resolveDateRange(query);
    const shouldCompare = this.shouldComparePreviousPeriod(range);

    const [users, interactions] = await Promise.all([
      this.analyticsRepository.getUsersByTimePeriod(
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

    const customerMetrics = calculateCustomerMetrics(users);
    const previousUsers = shouldCompare
      ? await this.analyticsRepository.getUsersByTimePeriod(
          range.previousStartDate,
          range.previousEndDate,
          range.yearStart,
          range.yearEnd
        )
      : [];
    const previousMetrics = calculateCustomerMetrics(previousUsers);

    const retentionRate = shouldCompare
      ? calculateRetentionRate(users, previousUsers)
      : 0;
    const { scores: engagementScores, averageScore: engagementScore } =
      calculateEngagementScores(interactions);
    const topUsers = generateTopCustomers(users, engagementScores);
    const interactionTrends = aggregateInteractionTrends(interactions);
    const changes = calculateChanges(
      { totalUsers: customerMetrics.totalCustomers },
      { totalUsers: previousMetrics.totalCustomers },
      shouldCompare
    );

    return {
      totalUsers: customerMetrics.totalCustomers,
      totalRevenue: this.round(customerMetrics.totalRevenue),
      retentionRate: this.round(retentionRate),
      lifetimeValue: this.round(customerMetrics.lifetimeValue),
      repeatPurchaseRate: this.round(customerMetrics.repeatPurchaseRate),
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
