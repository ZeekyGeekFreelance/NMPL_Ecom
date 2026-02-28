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
exports.AnalyticsRepository = void 0;
const database_config_1 = __importDefault(require("@/infra/database/database.config"));
const client_1 = require("@prisma/client");
const analytics_1 = require("@/shared/utils/analytics");
const orderStatus_1 = require("@/shared/utils/orderStatus");
class AnalyticsRepository {
    getOrderYearRange() {
        return __awaiter(this, void 0, void 0, function* () {
            const orders = yield database_config_1.default.order.findMany({
                select: { orderDate: true },
                orderBy: { orderDate: "asc" },
                where: {
                    status: {
                        in: [...orderStatus_1.CONFIRMED_ORDER_STATUS_VALUES],
                    },
                },
            });
            const years = [
                ...new Set(orders.map((order) => order.orderDate.getFullYear())),
            ];
            return years;
        });
    }
    getOrdersByTimePeriod(start, end, yearStart, yearEnd) {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.order.findMany({
                where: {
                    orderDate: (0, analytics_1.buildDateFilter)(start, end, yearStart, yearEnd),
                    status: {
                        in: [...orderStatus_1.CONFIRMED_ORDER_STATUS_VALUES],
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
        });
    }
    getOrderItemsByTimePeriod(start, end, yearStart, yearEnd, category) {
        return __awaiter(this, void 0, void 0, function* () {
            const orderDateFilter = (0, analytics_1.buildDateFilter)(start, end, yearStart, yearEnd);
            return database_config_1.default.orderItem.findMany({
                where: Object.assign({ order: {
                        orderDate: orderDateFilter,
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
                                include: {
                                    category: true,
                                },
                            },
                        },
                    },
                },
            });
        });
    }
    getUsersByTimePeriod(start, end, yearStart, yearEnd) {
        return __awaiter(this, void 0, void 0, function* () {
            const orderDateFilter = (0, analytics_1.buildDateFilter)(start, end, yearStart, yearEnd);
            return database_config_1.default.user.findMany({
                where: {
                    role: client_1.ROLE.USER,
                    orders: {
                        some: {
                            orderDate: orderDateFilter,
                            status: {
                                in: [...orderStatus_1.CONFIRMED_ORDER_STATUS_VALUES],
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
                                in: [...orderStatus_1.CONFIRMED_ORDER_STATUS_VALUES],
                            },
                        },
                    },
                },
            });
        });
    }
    getInteractionsByTimePeriod(start, end, yearStart, yearEnd) {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.interaction.findMany({
                where: {
                    createdAt: (0, analytics_1.buildDateFilter)(start, end, yearStart, yearEnd),
                },
                include: { user: true, product: true },
            });
        });
    }
    createInteraction(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.interaction.create({
                data: {
                    userId: data.userId,
                    sessionId: data.sessionId,
                    productId: data.productId,
                    type: data.type,
                },
            });
        });
    }
}
exports.AnalyticsRepository = AnalyticsRepository;
