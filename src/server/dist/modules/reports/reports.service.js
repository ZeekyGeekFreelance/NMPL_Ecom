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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsService = void 0;
const date_fns_1 = require("date-fns");
const redis_1 = __importDefault(require("@/infra/cache/redis"));
class ReportsService {
    constructor(reportsRepository, analyticsRepository) {
        this.reportsRepository = reportsRepository;
        this.analyticsRepository = analyticsRepository;
    }
    generateSalesReport(query) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const { timePeriod, year, startDate, endDate } = query;
            const cacheKey = `reports:sales:${timePeriod}:${year || "all"}:${(startDate === null || startDate === void 0 ? void 0 : startDate.toISOString()) || "none"}:${(endDate === null || endDate === void 0 ? void 0 : endDate.toISOString()) || "none"}`;
            const cachedData = yield redis_1.default.get(cacheKey);
            if (cachedData) {
                return JSON.parse(cachedData);
            }
            const { currentStartDate, currentEndDate, yearStart, yearEnd } = this.getDateRange(query);
            const orders = yield this.analyticsRepository.getOrdersByTimePeriod(currentStartDate, currentEndDate, yearStart, yearEnd);
            const orderItems = yield this.analyticsRepository.getOrderItemsByTimePeriod(currentStartDate, currentEndDate, yearStart, yearEnd);
            // Core Metrics
            const totalRevenue = orders.reduce((sum, order) => sum + order.amount, 0);
            const totalOrders = orders.length;
            const totalSales = orderItems.reduce((sum, item) => sum + item.quantity, 0);
            const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
            // By Category
            const categorySales = {};
            for (const item of orderItems) {
                const product = (_a = item.variant) === null || _a === void 0 ? void 0 : _a.product;
                const categoryId = (product === null || product === void 0 ? void 0 : product.categoryId) || "uncategorized";
                const categoryName = ((_b = product === null || product === void 0 ? void 0 : product.category) === null || _b === void 0 ? void 0 : _b.name) || "Uncategorized";
                if (!categorySales[categoryId]) {
                    categorySales[categoryId] = {
                        revenue: 0,
                        sales: 0,
                        name: categoryName,
                    };
                }
                categorySales[categoryId].revenue +=
                    item.quantity * (item.price || ((_c = item.variant) === null || _c === void 0 ? void 0 : _c.price) || 0);
                categorySales[categoryId].sales += item.quantity;
            }
            const byCategory = Object.values(categorySales)
                .map((data) => ({
                categoryName: data.name,
                revenue: data.revenue,
                sales: data.sales,
            }))
                .sort((first, second) => second.revenue - first.revenue);
            // Top Products
            const productSales = {};
            for (const item of orderItems) {
                const sku = ((_d = item.variant) === null || _d === void 0 ? void 0 : _d.sku) || "N/A";
                const productId = ((_e = item.variant) === null || _e === void 0 ? void 0 : _e.productId) || item.variantId;
                const aggregationKey = `${productId}:${sku}`;
                if (!productSales[aggregationKey]) {
                    productSales[aggregationKey] = {
                        productId,
                        sku,
                        productName: ((_g = (_f = item.variant) === null || _f === void 0 ? void 0 : _f.product) === null || _g === void 0 ? void 0 : _g.name) || "Unknown",
                        quantity: 0,
                        revenue: 0,
                    };
                }
                productSales[aggregationKey].quantity += item.quantity;
                productSales[aggregationKey].revenue +=
                    item.quantity * (item.price || ((_h = item.variant) === null || _h === void 0 ? void 0 : _h.price) || 0);
            }
            const topProducts = Object.values(productSales)
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 5);
            const result = {
                totalRevenue: Number(totalRevenue.toFixed(2)),
                totalOrders,
                totalSales,
                averageOrderValue: Number(averageOrderValue.toFixed(2)),
                byCategory,
                topProducts,
            };
            yield redis_1.default.setex(cacheKey, 300, JSON.stringify(result));
            return result;
        });
    }
    generateUserRetentionReport(query) {
        return __awaiter(this, void 0, void 0, function* () {
            const { timePeriod, year, startDate, endDate } = query;
            const cacheKey = `reports:user_retention:${timePeriod}:${year || "all"}:${(startDate === null || startDate === void 0 ? void 0 : startDate.toISOString()) || "none"}:${(endDate === null || endDate === void 0 ? void 0 : endDate.toISOString()) || "none"}`;
            const cachedData = yield redis_1.default.get(cacheKey);
            if (cachedData) {
                return JSON.parse(cachedData);
            }
            const { currentStartDate, currentEndDate, previousStartDate, previousEndDate, yearStart, yearEnd, } = this.getDateRange(query);
            const users = yield this.analyticsRepository.getUsersByTimePeriod(currentStartDate, currentEndDate, yearStart, yearEnd);
            const totalCustomers = users.length;
            // Retention Rate
            let retentionRate = 0;
            if (timePeriod !== "allTime" &&
                timePeriod !== "custom" &&
                previousStartDate &&
                previousEndDate) {
                const previousUsers = yield this.analyticsRepository.getUsersByTimePeriod(previousStartDate, previousEndDate, yearStart, yearEnd);
                const previousUserIds = new Set(previousUsers.map((user) => user.id));
                const retainedCustomers = users.filter((user) => previousUserIds.has(user.id) && user.orders.length > 0).length;
                retentionRate =
                    previousUsers.length > 0
                        ? (retainedCustomers / previousUsers.length) * 100
                        : 0;
            }
            // Lifetime Value
            const totalRevenue = users.reduce((sum, user) => {
                const userRevenue = user.orders.reduce((orderSum, order) => orderSum + order.amount, 0);
                return sum + userRevenue;
            }, 0);
            const lifetimeValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
            // Repeat Purchase Rate
            const repeatCustomers = users.filter((user) => user.orders.length > 1).length;
            const repeatPurchaseRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;
            // Top Customers
            const topCustomers = users
                .map((user) => ({
                userId: user.id,
                name: user.name || "Unknown",
                email: user.email,
                orderCount: user.orders.length,
                totalSpent: user.orders.reduce((sum, order) => sum + order.amount, 0),
            }))
                .sort((a, b) => b.totalSpent - a.totalSpent)
                .slice(0, 5);
            const result = {
                totalUsers: totalCustomers,
                retentionRate: Number(retentionRate.toFixed(2)),
                repeatPurchaseRate: Number(repeatPurchaseRate.toFixed(2)),
                lifetimeValue: Number(lifetimeValue.toFixed(2)),
                topUsers: topCustomers,
            };
            yield redis_1.default.setex(cacheKey, 300, JSON.stringify(result));
            return result;
        });
    }
    logReport(data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            yield this.reportsRepository.createReport({
                type: data.type,
                format: data.format,
                userId: (_a = data.userId) !== null && _a !== void 0 ? _a : "",
                parameters: data.parameters,
                filePath: null,
            });
        });
    }
    getDateRange(query) {
        const now = new Date();
        let currentStartDate;
        let currentEndDate = now;
        let previousStartDate;
        let previousEndDate;
        let yearStart;
        let yearEnd;
        if (query.year) {
            yearStart = (0, date_fns_1.startOfYear)(new Date(query.year, 0, 1));
            yearEnd = (0, date_fns_1.endOfYear)(new Date(query.year, 0, 1));
        }
        if (query.startDate && query.endDate) {
            currentStartDate = query.startDate;
            currentEndDate = query.endDate;
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
                    if (!query.year && !query.startDate && !query.endDate) {
                        yearStart = (0, date_fns_1.startOfYear)(now);
                        yearEnd = (0, date_fns_1.endOfYear)(now);
                    }
                    currentStartDate = undefined;
                    currentEndDate = undefined;
                    break;
                case "custom":
                    throw new Error("Custom time period requires startDate and endDate");
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
}
exports.ReportsService = ReportsService;
