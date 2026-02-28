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
const productPerformance = {
    Query: {
        productPerformance: (_1, _a, _b) => __awaiter(void 0, [_1, _a, _b], void 0, function* (_, { params }, { prisma }) {
            var _c, _d, _e;
            const { timePeriod, year, startDate, endDate, category } = params;
            const { currentStartDate, yearStart, yearEnd } = (0, analytics_1.getDateRange)({
                timePeriod,
                year,
                startDate,
                endDate,
            });
            const currentOrderDateFilter = (0, analytics_1.buildDateFilter)(currentStartDate, endDate, yearStart, yearEnd);
            const orderItems = yield prisma.orderItem.findMany({
                where: Object.assign({ order: {
                        orderDate: currentOrderDateFilter,
                        status: {
                            in: [...orderStatus_1.CONFIRMED_ORDER_STATUS_VALUES],
                        },
                    } }, (category && {
                    variant: {
                        product: {
                            category: {
                                name: category,
                            },
                        },
                    },
                })),
                include: {
                    order: {
                        select: {
                            orderDate: true,
                        },
                    },
                    variant: {
                        include: {
                            product: {
                                select: {
                                    id: true,
                                    name: true,
                                    slug: true,
                                },
                            },
                        },
                    },
                },
            });
            const productSales = {};
            for (const item of orderItems) {
                const productId = ((_c = item.variant.product) === null || _c === void 0 ? void 0 : _c.id) || item.variantId;
                const productName = ((_d = item.variant.product) === null || _d === void 0 ? void 0 : _d.name) || item.variant.sku || "Unknown";
                const productSlug = ((_e = item.variant.product) === null || _e === void 0 ? void 0 : _e.slug) || null;
                const sku = item.variant.sku || null;
                if (!productSales[productId]) {
                    productSales[productId] = {
                        id: productId,
                        productId,
                        productSlug,
                        sku,
                        name: productName,
                        quantity: 0,
                        revenue: 0,
                        skuSales: {},
                    };
                }
                if (sku) {
                    productSales[productId].skuSales[sku] =
                        (productSales[productId].skuSales[sku] || 0) + item.quantity;
                }
                productSales[productId].quantity += item.quantity;
                productSales[productId].revenue +=
                    item.quantity * (item.price || 0);
            }
            return Object.values(productSales)
                .map((product) => {
                var _a;
                const topSku = (_a = Object.entries(product.skuSales).sort((first, second) => second[1] - first[1])[0]) === null || _a === void 0 ? void 0 : _a[0];
                return {
                    id: product.id,
                    productId: product.productId,
                    productSlug: product.productSlug,
                    sku: topSku || product.sku,
                    name: product.name,
                    quantity: product.quantity,
                    revenue: product.revenue,
                };
            })
                .sort((a, b) => b.quantity - a.quantity);
        }),
    },
};
exports.default = productPerformance;
