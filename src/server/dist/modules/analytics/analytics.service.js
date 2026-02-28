"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const date_fns_1 = require("date-fns");
const analytics_1 = require("@/shared/utils/analytics");
class AnalyticsService {
    constructor(analyticsRepository) {
        this.analyticsRepository = analyticsRepository;
    }
    createInteraction(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.analyticsRepository.createInteraction({
                userId: data.userId,
                sessionId: data.sessionId,
                productId: data.productId,
                type: data.type,
            });
        });
    }
    round(value) {
        return Number(value.toFixed(2));
    }
    roundNullable(value) {
        if (value === null || value === undefined) {
            return null;
        }
        return this.round(value);
    }
    shouldComparePreviousPeriod(range) {
        return Boolean(range.previousStartDate && range.previousEndDate);
    }
    resolveDateRange(query) {
        const now = new Date();
        let currentStartDate;
        let currentEndDate = now;
        let previousStartDate;
        let previousEndDate;
        let yearStart;
        let yearEnd;
        if (query.year !== undefined) {
            if (!Number.isInteger(query.year) ||
                query.year < 1900 ||
                query.year > now.getFullYear()) {
                throw new Error("Invalid year range.");
            }
            yearStart = (0, date_fns_1.startOfYear)(new Date(query.year, 0, 1));
            yearEnd = (0, date_fns_1.endOfYear)(new Date(query.year, 0, 1));
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
        }
        else {
            switch (query.timePeriod) {
                case "last7days":
                    currentStartDate = (0, date_fns_1.subDays)(now, 7);
                    previousStartDate = (0, date_fns_1.subDays)(now, 14);
                    previousEndDate = (0, date_fns_1.subDays)(now, 7);
                    break;
                case "lastMonth":
                    currentStartDate = (0, date_fns_1.subMonths)(now, 1);
                    previousStartDate = (0, date_fns_1.subMonths)(now, 2);
                    previousEndDate = (0, date_fns_1.subMonths)(now, 1);
                    break;
                case "lastYear":
                    currentStartDate = (0, date_fns_1.subYears)(now, 1);
                    previousStartDate = (0, date_fns_1.subYears)(now, 2);
                    previousEndDate = (0, date_fns_1.subYears)(now, 1);
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
    getAnalyticsOverview(query) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const range = this.resolveDateRange(query);
            const shouldCompare = this.shouldComparePreviousPeriod(range);
            const [orders, orderItems, users] = yield Promise.all([
                this.analyticsRepository.getOrdersByTimePeriod(range.currentStartDate, range.currentEndDate, range.yearStart, range.yearEnd),
                this.analyticsRepository.getOrderItemsByTimePeriod(range.currentStartDate, range.currentEndDate, range.yearStart, range.yearEnd),
                this.analyticsRepository.getUsersByTimePeriod(range.currentStartDate, range.currentEndDate, range.yearStart, range.yearEnd),
            ]);
            const currentMetrics = (0, analytics_1.calculateMetrics)(orders, orderItems, users);
            const [previousOrders, previousOrderItems, previousUsers] = shouldCompare
                ? yield Promise.all([
                    this.analyticsRepository.getOrdersByTimePeriod(range.previousStartDate, range.previousEndDate, range.yearStart, range.yearEnd),
                    this.analyticsRepository.getOrderItemsByTimePeriod(range.previousStartDate, range.previousEndDate, range.yearStart, range.yearEnd),
                    this.analyticsRepository.getUsersByTimePeriod(range.previousStartDate, range.previousEndDate, range.yearStart, range.yearEnd),
                ])
                : [[], [], []];
            const previousMetrics = (0, analytics_1.calculateMetrics)(previousOrders, previousOrderItems, previousUsers);
            const changes = (0, analytics_1.calculateChanges)(currentMetrics, previousMetrics, shouldCompare);
            const trendStartDate = (_a = range.yearStart) !== null && _a !== void 0 ? _a : range.currentStartDate;
            const trendEndDate = (_b = range.yearEnd) !== null && _b !== void 0 ? _b : range.currentEndDate;
            const [trendOrders, trendOrderItems] = yield Promise.all([
                this.analyticsRepository.getOrdersByTimePeriod(trendStartDate, trendEndDate),
                this.analyticsRepository.getOrderItemsByTimePeriod(trendStartDate, trendEndDate),
            ]);
            const monthlyTrends = (0, analytics_1.aggregateMonthlyTrends)(trendOrders, trendOrderItems, []);
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
        });
    }
    getProductPerformance(query) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const range = this.resolveDateRange(query);
            const orderItems = yield this.analyticsRepository.getOrderItemsByTimePeriod(range.currentStartDate, range.currentEndDate, range.yearStart, range.yearEnd, query.category);
            const productSales = {};
            for (const item of orderItems) {
                const productId = ((_a = item.variant.product) === null || _a === void 0 ? void 0 : _a.id) || item.variantId;
                const productName = ((_b = item.variant.product) === null || _b === void 0 ? void 0 : _b.name) || item.variant.sku || "Unknown";
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
                var _a;
                const topSku = (_a = Object.entries(product.skuSales).sort((first, second) => second[1] - first[1])[0]) === null || _a === void 0 ? void 0 : _a[0];
                return {
                    id: product.id,
                    sku: topSku || product.sku,
                    name: product.name,
                    quantity: product.quantity,
                    revenue: this.round(product.revenue),
                };
            })
                .sort((first, second) => second.quantity - first.quantity);
        });
    }
    getUserAnalytics(query) {
        return __awaiter(this, void 0, void 0, function* () {
            const range = this.resolveDateRange(query);
            const shouldCompare = this.shouldComparePreviousPeriod(range);
            const [users, interactions] = yield Promise.all([
                this.analyticsRepository.getUsersByTimePeriod(range.currentStartDate, range.currentEndDate, range.yearStart, range.yearEnd),
                this.analyticsRepository.getInteractionsByTimePeriod(range.currentStartDate, range.currentEndDate, range.yearStart, range.yearEnd),
            ]);
            const customerMetrics = (0, analytics_1.calculateCustomerMetrics)(users);
            const previousUsers = shouldCompare
                ? yield this.analyticsRepository.getUsersByTimePeriod(range.previousStartDate, range.previousEndDate, range.yearStart, range.yearEnd)
                : [];
            const previousMetrics = (0, analytics_1.calculateCustomerMetrics)(previousUsers);
            const retentionRate = shouldCompare
                ? (0, analytics_1.calculateRetentionRate)(users, previousUsers)
                : 0;
            const { scores: engagementScores, averageScore: engagementScore } = (0, analytics_1.calculateEngagementScores)(interactions);
            const topUsers = (0, analytics_1.generateTopCustomers)(users, engagementScores);
            const interactionTrends = (0, analytics_1.aggregateInteractionTrends)(interactions);
            const changes = (0, analytics_1.calculateChanges)({ totalUsers: customerMetrics.totalCustomers }, { totalUsers: previousMetrics.totalCustomers }, shouldCompare);
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
        });
    }
    getYearRange() {
        return __awaiter(this, void 0, void 0, function* () {
            const years = yield this.analyticsRepository.getOrderYearRange();
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
        });
    }
}
exports.AnalyticsService = AnalyticsService;
