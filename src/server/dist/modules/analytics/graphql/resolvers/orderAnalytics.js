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
const analytics_1 = require("@/shared/utils/analytics");
const orderStatus_1 = require("@/shared/utils/orderStatus");
const orderAnalytics = {
    Query: {
        orderAnalytics: (_1, _a, _b) => __awaiter(void 0, [_1, _a, _b], void 0, function* (_, { params }, { prisma }) {
            const { timePeriod, year, startDate, endDate } = params;
            const { currentStartDate, previousStartDate, previousEndDate, yearStart, yearEnd, } = (0, analytics_1.getDateRange)({ timePeriod, year, startDate, endDate });
            const currentOrderDateFilter = (0, analytics_1.buildDateFilter)(currentStartDate, endDate, yearStart, yearEnd);
            const currentOrders = yield (0, analytics_1.fetchData)(prisma, "order", "orderDate", currentStartDate, endDate, yearStart, yearEnd, undefined, undefined, {
                status: {
                    in: [...orderStatus_1.CONFIRMED_ORDER_STATUS_VALUES],
                },
            });
            const currentOrderItems = yield prisma.orderItem.findMany({
                where: {
                    order: {
                        orderDate: currentOrderDateFilter,
                        status: {
                            in: [...orderStatus_1.CONFIRMED_ORDER_STATUS_VALUES],
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
            const fetchPrevious = (0, analytics_1.shouldFetchPreviousPeriod)(timePeriod);
            const previousOrderDateFilter = (0, analytics_1.buildDateFilter)(previousStartDate, previousEndDate, yearStart, yearEnd);
            const previousOrders = fetchPrevious
                ? yield (0, analytics_1.fetchData)(prisma, "order", "orderDate", previousStartDate, previousEndDate, yearStart, yearEnd, undefined, undefined, {
                    status: {
                        in: [...orderStatus_1.CONFIRMED_ORDER_STATUS_VALUES],
                    },
                })
                : [];
            const previousOrderItems = fetchPrevious
                ? yield prisma.orderItem.findMany({
                    where: {
                        order: {
                            orderDate: previousOrderDateFilter,
                            status: {
                                in: [...orderStatus_1.CONFIRMED_ORDER_STATUS_VALUES],
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
            const currentMetrics = (0, analytics_1.calculateMetrics)(currentOrders, currentOrderItems, []);
            const previousMetrics = (0, analytics_1.calculateMetrics)(previousOrders, previousOrderItems, []);
            const changes = (0, analytics_1.calculateChanges)(currentMetrics, previousMetrics, fetchPrevious);
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
        }),
    },
};
exports.default = orderAnalytics;
