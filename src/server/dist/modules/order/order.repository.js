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
const accountReference_1 = require("@/shared/utils/accountReference");
const orderLifecycle_1 = require("@/shared/utils/orderLifecycle");
class OrderRepository {
    extractReferenceChecksum(reference) {
        const normalizedReference = (reference || "").trim().toUpperCase();
        const [, token = ""] = normalizedReference.split("-");
        const cleanToken = token.replace(/[^A-Z0-9]/g, "");
        if (cleanToken.length < 2) {
            return null;
        }
        return cleanToken.slice(-2).toLowerCase();
    }
    findAllOrders() {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.order.findMany({
                orderBy: { orderDate: "desc" },
                include: {
                    orderItems: { include: { variant: { include: { product: true } } } },
                    quotationLogs: {
                        orderBy: {
                            createdAt: "desc",
                        },
                    },
                    reservation: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true,
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
    findOrdersByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.order.findMany({
                where: { userId },
                orderBy: { orderDate: "desc" },
                include: {
                    orderItems: { include: { variant: { include: { product: true } } } },
                    quotationLogs: {
                        orderBy: {
                            createdAt: "desc",
                        },
                    },
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
                    reservation: true,
                    quotationLogs: {
                        orderBy: {
                            createdAt: "desc",
                        },
                    },
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true,
                            role: true,
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
    findOrderIdByReferenceForUser(orderReference, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const normalizedReference = (orderReference || "").trim().toUpperCase();
            if (!normalizedReference) {
                return null;
            }
            const checksum = this.extractReferenceChecksum(normalizedReference);
            const candidates = yield database_config_1.default.order.findMany({
                where: Object.assign({ userId }, (checksum ? { id: { endsWith: checksum } } : {})),
                select: { id: true },
                orderBy: { orderDate: "desc" },
            });
            const matches = candidates.filter((candidate) => (0, accountReference_1.toOrderReference)(candidate.id) === normalizedReference);
            if (matches.length > 1) {
                throw new AppError_1.default(409, "Multiple orders matched this reference");
            }
            return (_b = (_a = matches[0]) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null;
        });
    }
    createOrder(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const computedSubtotal = data.orderItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
                const normalizedSubtotal = Number(computedSubtotal.toFixed(2));
                const subtotalFromPricing = Number(data.pricing.subtotalAmount.toFixed(2));
                if (Math.abs(normalizedSubtotal - subtotalFromPricing) > 0.01) {
                    throw new AppError_1.default(409, "Pricing mismatch detected. Please refresh checkout summary and retry.");
                }
                const deliveryCharge = Number(data.pricing.deliveryCharge.toFixed(2));
                const computedAmount = Number((normalizedSubtotal + deliveryCharge).toFixed(2));
                // Validate variants and quantities, but do not deduct stock at placement time.
                for (const item of data.orderItems) {
                    if (item.quantity <= 0) {
                        throw new AppError_1.default(400, "Order item quantity must be greater than 0");
                    }
                    const variant = yield tx.productVariant.findUnique({
                        where: { id: item.variantId },
                        select: { id: true },
                    });
                    if (!variant) {
                        throw new AppError_1.default(404, `Variant not found: ${item.variantId}`);
                    }
                }
                // Create order in verification queue. Stock is reserved only after admin verification.
                const order = yield tx.order.create({
                    data: {
                        userId: data.userId,
                        customerRoleSnapshot: data.customerRoleSnapshot,
                        subtotalAmount: normalizedSubtotal,
                        deliveryCharge,
                        deliveryMode: data.pricing.deliveryMode,
                        amount: computedAmount,
                        status: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION,
                        address: {
                            create: {
                                sourceAddressId: data.addressSnapshot.sourceAddressId,
                                addressType: data.addressSnapshot.addressType,
                                fullName: data.addressSnapshot.fullName,
                                phoneNumber: data.addressSnapshot.phoneNumber,
                                line1: data.addressSnapshot.line1,
                                line2: data.addressSnapshot.line2,
                                landmark: data.addressSnapshot.landmark,
                                city: data.addressSnapshot.city,
                                state: data.addressSnapshot.state,
                                country: data.addressSnapshot.country,
                                pincode: data.addressSnapshot.pincode,
                                deliveryMode: data.pricing.deliveryMode,
                                deliveryCharge,
                                deliveryLabel: data.pricing.deliveryLabel,
                                serviceArea: (_a = data.pricing.serviceArea) !== null && _a !== void 0 ? _a : null,
                            },
                        },
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
                                method: "QUOTATION_PENDING",
                                amount: computedAmount,
                                status: client_1.PAYMENT_STATUS.PENDING,
                            },
                        },
                        transaction: {
                            create: {
                                status: client_1.TRANSACTION_STATUS.PENDING_VERIFICATION,
                            },
                        },
                    },
                    include: {
                        orderItems: {
                            include: {
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
                        },
                        payment: true,
                        transaction: true,
                        reservation: true,
                        address: true,
                    },
                });
                const initialLineItems = order.orderItems.map((item) => {
                    var _a, _b, _c;
                    return ({
                        orderItemId: item.id,
                        variantId: item.variantId,
                        sku: ((_a = item.variant) === null || _a === void 0 ? void 0 : _a.sku) || null,
                        productName: ((_c = (_b = item.variant) === null || _b === void 0 ? void 0 : _b.product) === null || _c === void 0 ? void 0 : _c.name) || "Product",
                        quantity: item.quantity,
                        unitPrice: Number(item.price),
                        lineTotal: Number((item.quantity * item.price).toFixed(2)),
                    });
                });
                yield tx.orderQuotationLog.create({
                    data: {
                        orderId: order.id,
                        event: client_1.ORDER_QUOTATION_LOG_EVENT.ORIGINAL_ORDER,
                        previousTotal: Number(computedAmount.toFixed(2)),
                        updatedTotal: Number(computedAmount.toFixed(2)),
                        currency: "INR",
                        actorUserId: data.userId,
                        actorRole: data.customerRoleSnapshot,
                        message: "Initial order amount submitted for verification.",
                        lineItems: initialLineItems,
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
