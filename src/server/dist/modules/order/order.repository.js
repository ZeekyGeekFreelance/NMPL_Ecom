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
exports.OrderRepository = void 0;
const database_config_1 = __importDefault(require("@/infra/database/database.config"));
const client_1 = require("@prisma/client");
const AppError_1 = __importDefault(require("@/shared/errors/AppError"));
class OrderRepository {
    findAllOrders() {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.order.findMany({
                orderBy: { orderDate: "desc" },
                include: {
                    orderItems: { include: { variant: { include: { product: true } } } },
                },
            });
        });
    }
    findOrdersByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.order.findMany({
                where: { userId },
                orderBy: { orderDate: "desc" },
                include: {
                    orderItems: { include: { variant: { include: { product: true } } } },
                },
            });
        });
    }
    findOrderById(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.order.findUnique({
                where: { id: orderId },
                include: {
                    orderItems: { include: { variant: { include: { product: true } } } },
                    payment: true,
                    address: true,
                    shipment: true,
                    transaction: true,
                },
            });
        });
    }
    createOrder(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                const computedAmount = data.orderItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
                // Atomic stock-safe deduction. If any item cannot be decremented, transaction rolls back.
                for (const item of data.orderItems) {
                    if (item.quantity <= 0) {
                        throw new AppError_1.default(400, "Order item quantity must be greater than 0");
                    }
                    const variant = yield tx.productVariant.findUnique({
                        where: { id: item.variantId },
                        select: { stock: true, productId: true },
                    });
                    if (!variant) {
                        throw new AppError_1.default(404, `Variant not found: ${item.variantId}`);
                    }
                    const decrementResult = yield tx.productVariant.updateMany({
                        where: {
                            id: item.variantId,
                            stock: { gte: item.quantity },
                        },
                        data: {
                            stock: { decrement: item.quantity },
                        },
                    });
                    if (decrementResult.count === 0) {
                        throw new AppError_1.default(400, `Insufficient stock for variant ${item.variantId}: only ${variant.stock} available`);
                    }
                    yield tx.product.update({
                        where: { id: variant.productId },
                        data: {
                            salesCount: { increment: item.quantity },
                        },
                    });
                }
                // Create order with pending offline payment and transaction records.
                const order = yield tx.order.create({
                    data: {
                        userId: data.userId,
                        amount: computedAmount,
                        status: "PENDING",
                        orderItems: {
                            create: data.orderItems.map((item) => ({
                                variantId: item.variantId,
                                quantity: item.quantity,
                                price: item.price,
                            })),
                        },
                        payment: {
                            create: {
                                userId: data.userId,
                                method: "OFFLINE_CONFIRMATION",
                                amount: computedAmount,
                                status: client_1.PAYMENT_STATUS.PENDING,
                            },
                        },
                        transaction: {
                            create: {
                                status: client_1.TRANSACTION_STATUS.PENDING,
                            },
                        },
                    },
                    include: {
                        orderItems: true,
                        payment: true,
                        transaction: true,
                    },
                });
                if (data.cartId) {
                    yield tx.cartItem.deleteMany({
                        where: { cartId: data.cartId },
                    });
                    yield tx.cart.update({
                        where: { id: data.cartId },
                        data: { status: client_1.CART_STATUS.CONVERTED },
                    });
                }
                return order;
            }));
        });
    }
}
exports.OrderRepository = OrderRepository;
