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
exports.TransactionRepository = void 0;
const database_config_1 = __importDefault(require("@/infra/database/database.config"));
const AppError_1 = __importDefault(require("@/shared/errors/AppError"));
const accountReference_1 = require("@/shared/utils/accountReference");
const orderLifecycle_1 = require("@/shared/utils/orderLifecycle");
const client_1 = require("@prisma/client");
const statusToPrismaEnum = {
    PENDING_VERIFICATION: client_1.TRANSACTION_STATUS.PENDING_VERIFICATION,
    WAITLISTED: client_1.TRANSACTION_STATUS.WAITLISTED,
    AWAITING_PAYMENT: client_1.TRANSACTION_STATUS.AWAITING_PAYMENT,
    QUOTATION_REJECTED: client_1.TRANSACTION_STATUS.QUOTATION_REJECTED,
    QUOTATION_EXPIRED: client_1.TRANSACTION_STATUS.QUOTATION_EXPIRED,
    CONFIRMED: client_1.TRANSACTION_STATUS.CONFIRMED,
    DELIVERED: client_1.TRANSACTION_STATUS.DELIVERED,
};
class TransactionRepository {
    constructor() { }
    extractReferenceChecksum(reference) {
        const normalizedReference = (reference || "").trim().toUpperCase();
        const [, token = ""] = normalizedReference.split("-");
        const cleanToken = token.replace(/[^A-Z0-9]/g, "");
        if (cleanToken.length < 2) {
            return null;
        }
        return cleanToken.slice(-2).toLowerCase();
    }
    normalizeStatusValue(status) {
        const normalized = String(status || "").trim().toUpperCase();
        const legacyToCurrent = {
            PENDING_VERIFICATION: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION,
            WAITLISTED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.WAITLISTED,
            AWAITING_PAYMENT: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT,
            QUOTATION_REJECTED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
            QUOTATION_EXPIRED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_EXPIRED,
            CONFIRMED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.CONFIRMED,
            DELIVERED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.DELIVERED,
            PLACED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION,
            PENDING: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION,
            REJECTED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
            CANCELED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
            CANCELLED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
            RETURNED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
            REFUNDED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
            PROCESSING: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.CONFIRMED,
            SHIPPED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.CONFIRMED,
            IN_TRANSIT: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.CONFIRMED,
        };
        return (legacyToCurrent[normalized] || orderLifecycle_1.ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION);
    }
    findMany(params) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!params) {
                return database_config_1.default.transaction.findMany({
                    orderBy: {
                        transactionDate: "desc",
                    },
                });
            }
            const { skip = 0, take = 16 } = params;
            return database_config_1.default.transaction.findMany({
                skip,
                take,
                orderBy: {
                    transactionDate: "desc",
                },
            });
        });
    }
    countTransactions() {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.transaction.count();
        });
    }
    findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.transaction.findUnique({
                where: { id },
                include: {
                    order: {
                        include: {
                            payment: true,
                            reservation: true,
                            shipment: true,
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
                            address: true,
                            invoice: true,
                            quotationLogs: {
                                orderBy: {
                                    createdAt: "desc",
                                },
                            },
                            orderItems: {
                                include: {
                                    variant: {
                                        include: {
                                            product: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });
        });
    }
    findIdByReference(reference) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const normalizedReference = (reference || "").trim().toUpperCase();
            if (!normalizedReference) {
                return null;
            }
            const checksum = this.extractReferenceChecksum(normalizedReference);
            const candidates = yield database_config_1.default.transaction.findMany({
                where: checksum ? { id: { endsWith: checksum } } : undefined,
                select: { id: true },
                orderBy: { transactionDate: "desc" },
            });
            const matches = candidates.filter((candidate) => (0, accountReference_1.toTransactionReference)(candidate.id) === normalizedReference);
            if (matches.length > 1) {
                throw new AppError_1.default(409, "Multiple transactions matched this reference");
            }
            return (_b = (_a = matches[0]) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null;
        });
    }
    createTransaction(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.transaction.create({
                data,
            });
        });
    }
    findExpiredAwaitingPaymentTransactionIds(now) {
        return __awaiter(this, void 0, void 0, function* () {
            const rows = yield database_config_1.default.transaction.findMany({
                where: {
                    status: client_1.TRANSACTION_STATUS.AWAITING_PAYMENT,
                    order: {
                        reservation: {
                            is: {
                                status: client_1.RESERVATION_STATUS.ACTIVE,
                                expiresAt: {
                                    lte: now,
                                },
                            },
                        },
                    },
                },
                select: {
                    id: true,
                },
                orderBy: {
                    transactionDate: "asc",
                },
            });
            return rows.map((row) => row.id);
        });
    }
    sanitizeQuotationItemUpdate(rawItem) {
        const orderItemId = String((rawItem === null || rawItem === void 0 ? void 0 : rawItem.orderItemId) || "").trim();
        if (!orderItemId) {
            throw new AppError_1.default(400, "Each quotation row must include orderItemId.");
        }
        const quantity = Number(rawItem === null || rawItem === void 0 ? void 0 : rawItem.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) {
            throw new AppError_1.default(400, `Invalid quotation quantity for order item ${orderItemId}.`);
        }
        const price = Number(rawItem === null || rawItem === void 0 ? void 0 : rawItem.price);
        if (!Number.isFinite(price) || price < 0) {
            throw new AppError_1.default(400, `Invalid quotation price for order item ${orderItemId}.`);
        }
        return {
            orderItemId,
            quantity,
            price: Number(price.toFixed(2)),
        };
    }
    getOriginalOrderQuantityCaps(tx, order) {
        return __awaiter(this, void 0, void 0, function* () {
            const fallbackCaps = new Map();
            for (const item of order.orderItems) {
                fallbackCaps.set(item.id, Number(item.quantity) || 0);
            }
            const originalLog = yield tx.orderQuotationLog.findFirst({
                where: {
                    orderId: order.id,
                    event: client_1.ORDER_QUOTATION_LOG_EVENT.ORIGINAL_ORDER,
                },
                orderBy: {
                    createdAt: "asc",
                },
                select: {
                    lineItems: true,
                },
            });
            if (!originalLog || !Array.isArray(originalLog.lineItems)) {
                return fallbackCaps;
            }
            const parsedCaps = new Map();
            for (const entry of originalLog.lineItems) {
                const row = entry && typeof entry === "object"
                    ? entry
                    : null;
                if (!row) {
                    continue;
                }
                const orderItemId = String(row.orderItemId || "").trim();
                const quantity = Number(row.quantity);
                if (!orderItemId || !Number.isInteger(quantity) || quantity <= 0) {
                    continue;
                }
                parsedCaps.set(orderItemId, quantity);
            }
            if (parsedCaps.size === 0) {
                return fallbackCaps;
            }
            for (const [orderItemId, fallbackQty] of fallbackCaps.entries()) {
                if (!parsedCaps.has(orderItemId)) {
                    parsedCaps.set(orderItemId, fallbackQty);
                }
            }
            return parsedCaps;
        });
    }
    getOrderSnapshot(tx, orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const order = yield tx.order.findUnique({
                where: {
                    id: orderId,
                },
                select: {
                    id: true,
                    userId: true,
                    amount: true,
                    orderDate: true,
                    verificationQueuedAt: true,
                    status: true,
                    reservationExpiresAt: true,
                    reservation: {
                        select: {
                            id: true,
                            status: true,
                            expiresAt: true,
                        },
                    },
                    payment: {
                        select: {
                            id: true,
                            status: true,
                        },
                    },
                    orderItems: {
                        select: {
                            id: true,
                            variantId: true,
                            quantity: true,
                            price: true,
                            variant: {
                                select: {
                                    productId: true,
                                    sku: true,
                                    stock: true,
                                    reservedStock: true,
                                    product: {
                                        select: {
                                            name: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });
            if (!order) {
                throw new AppError_1.default(404, "Order not found");
            }
            return order;
        });
    }
    applyQuotationAdjustments(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { tx, order, quotationItems } = params;
            if (!quotationItems.length) {
                throw new AppError_1.default(400, "Quotation update requires at least one line item.");
            }
            if (!order.orderItems.length) {
                throw new AppError_1.default(400, "Cannot issue quotation for an empty order.");
            }
            const orderItemById = new Map(order.orderItems.map((item) => [item.id, item]));
            const originalOrderQuantityCaps = yield this.getOriginalOrderQuantityCaps(tx, order);
            const sanitizedUpdates = new Map();
            for (const rawItem of quotationItems) {
                const sanitized = this.sanitizeQuotationItemUpdate(rawItem);
                if (!orderItemById.has(sanitized.orderItemId)) {
                    throw new AppError_1.default(400, `Quotation row ${sanitized.orderItemId} does not belong to this order.`);
                }
                if (sanitizedUpdates.has(sanitized.orderItemId)) {
                    throw new AppError_1.default(400, `Duplicate quotation row submitted for order item ${sanitized.orderItemId}.`);
                }
                const existingItem = orderItemById.get(sanitized.orderItemId);
                const originalQuantityCap = originalOrderQuantityCaps.get(sanitized.orderItemId) ||
                    Number(existingItem.quantity) ||
                    0;
                if (sanitized.quantity > originalQuantityCap) {
                    throw new AppError_1.default(400, `Quoted quantity for variant ${existingItem.variantId} cannot exceed original ordered quantity (${originalQuantityCap}).`);
                }
                const availableStock = Math.max(0, (Number(existingItem.variant.stock) || 0) -
                    (Number(existingItem.variant.reservedStock) || 0));
                if (sanitized.quantity > availableStock) {
                    throw new AppError_1.default(409, `Quoted quantity for variant ${existingItem.variantId} exceeds available stock (${availableStock}).`);
                }
                sanitizedUpdates.set(sanitized.orderItemId, sanitized);
            }
            if (sanitizedUpdates.size !== order.orderItems.length) {
                throw new AppError_1.default(400, "Quotation update must include every order item exactly once.");
            }
            let quotedAmount = 0;
            for (const item of order.orderItems) {
                const update = sanitizedUpdates.get(item.id);
                quotedAmount += update.quantity * update.price;
                yield tx.orderItem.update({
                    where: {
                        id: item.id,
                    },
                    data: {
                        quantity: update.quantity,
                        price: update.price,
                    },
                });
            }
            yield tx.order.update({
                where: {
                    id: order.id,
                },
                data: {
                    amount: Number(quotedAmount.toFixed(2)),
                },
            });
            if (order.payment) {
                yield tx.payment.update({
                    where: {
                        id: order.payment.id,
                    },
                    data: {
                        amount: Number(quotedAmount.toFixed(2)),
                        status: client_1.PAYMENT_STATUS.PENDING,
                    },
                });
            }
        });
    }
    buildQuotationLineItems(orderItems) {
        return orderItems.map((item) => {
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
    }
    appendQuotationLog(params) {
        return __awaiter(this, void 0, void 0, function* () {
            yield params.tx.orderQuotationLog.create({
                data: {
                    orderId: params.orderId,
                    event: params.event,
                    previousTotal: params.previousTotal === undefined ? null : params.previousTotal,
                    updatedTotal: Number(params.updatedTotal.toFixed(2)),
                    currency: "INR",
                    actorUserId: params.actorUserId || null,
                    actorRole: params.actorRole || null,
                    message: params.message || null,
                    lineItems: params.lineItems,
                },
            });
        });
    }
    reserveStockForOrder(tx, orderItems) {
        return __awaiter(this, void 0, void 0, function* () {
            const reservedItems = [];
            for (const item of orderItems) {
                const reservedRowCount = yield tx.$executeRaw `
        UPDATE "ProductVariant"
        SET "reservedStock" = "reservedStock" + ${item.quantity},
            "updatedAt" = NOW()
        WHERE "id" = ${item.variantId}
          AND ("stock" - "reservedStock") >= ${item.quantity}
      `;
                if (reservedRowCount === 0) {
                    for (const reserved of reservedItems) {
                        yield tx.$executeRaw `
            UPDATE "ProductVariant"
            SET "reservedStock" = GREATEST(0, "reservedStock" - ${reserved.quantity}),
                "updatedAt" = NOW()
            WHERE "id" = ${reserved.variantId}
          `;
                    }
                    return false;
                }
                reservedItems.push({
                    variantId: item.variantId,
                    quantity: item.quantity,
                });
            }
            return true;
        });
    }
    upsertActiveReservation(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const existing = yield params.tx.orderReservation.findUnique({
                where: {
                    orderId: params.orderId,
                },
                select: {
                    id: true,
                },
            });
            if (existing) {
                yield params.tx.orderReservation.update({
                    where: {
                        id: existing.id,
                    },
                    data: {
                        status: client_1.RESERVATION_STATUS.ACTIVE,
                        expiresAt: params.expiresAt,
                        releasedAt: null,
                        consumedAt: null,
                        reason: null,
                    },
                });
                return;
            }
            yield params.tx.orderReservation.create({
                data: {
                    orderId: params.orderId,
                    status: client_1.RESERVATION_STATUS.ACTIVE,
                    expiresAt: params.expiresAt,
                },
            });
        });
    }
    releaseReservationStock(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const affectedVariantIds = params.order.orderItems.map((item) => item.variantId);
            const shouldReleaseStock = ((_a = params.order.reservation) === null || _a === void 0 ? void 0 : _a.status) === client_1.RESERVATION_STATUS.ACTIVE;
            if (shouldReleaseStock) {
                for (const item of params.order.orderItems) {
                    yield params.tx.$executeRaw `
          UPDATE "ProductVariant"
          SET "reservedStock" = GREATEST(0, "reservedStock" - ${item.quantity}),
              "updatedAt" = NOW()
          WHERE "id" = ${item.variantId}
        `;
                }
            }
            if (params.order.reservation) {
                yield params.tx.orderReservation.update({
                    where: {
                        id: params.order.reservation.id,
                    },
                    data: {
                        status: params.nextReservationStatus,
                        releasedAt: new Date(),
                        reason: params.reason,
                    },
                });
            }
            return affectedVariantIds;
        });
    }
    finalizePaidOrder(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (((_a = params.order.reservation) === null || _a === void 0 ? void 0 : _a.status) !== client_1.RESERVATION_STATUS.ACTIVE) {
                throw new AppError_1.default(409, "Order cannot be confirmed without an active reservation.");
            }
            for (const item of params.order.orderItems) {
                const deductedCount = yield params.tx.$executeRaw `
        UPDATE "ProductVariant"
        SET "stock" = "stock" - ${item.quantity},
            "reservedStock" = GREATEST(0, "reservedStock" - ${item.quantity}),
            "updatedAt" = NOW()
        WHERE "id" = ${item.variantId}
          AND "stock" >= ${item.quantity}
          AND "reservedStock" >= ${item.quantity}
      `;
                if (deductedCount === 0) {
                    throw new AppError_1.default(409, `Unable to confirm order. Reserved stock is inconsistent for variant ${item.variantId}.`);
                }
                yield params.tx.product.update({
                    where: {
                        id: item.variant.productId,
                    },
                    data: {
                        salesCount: {
                            increment: item.quantity,
                        },
                    },
                });
            }
            yield params.tx.orderReservation.update({
                where: {
                    id: params.order.reservation.id,
                },
                data: {
                    status: client_1.RESERVATION_STATUS.CONSUMED,
                    consumedAt: new Date(),
                    reason: "PAYMENT_CONFIRMED",
                },
            });
        });
    }
    ensurePaymentRecord(params) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!params.order.payment) {
                yield params.tx.payment.create({
                    data: {
                        orderId: params.order.id,
                        userId: params.order.userId,
                        method: "MANUAL_REVIEW",
                        amount: params.order.amount,
                        status: params.status,
                    },
                });
                return;
            }
            yield params.tx.payment.update({
                where: {
                    id: params.order.payment.id,
                },
                data: {
                    status: params.status,
                },
            });
        });
    }
    promoteWaitlistedOrders(params) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!params.variantIds.length) {
                return [];
            }
            const waitlistedOrders = yield params.tx.order.findMany({
                where: {
                    status: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.WAITLISTED,
                    orderItems: {
                        some: {
                            variantId: {
                                in: params.variantIds,
                            },
                        },
                    },
                },
                include: {
                    transaction: true,
                    payment: {
                        select: {
                            id: true,
                            status: true,
                        },
                    },
                    reservation: {
                        select: {
                            id: true,
                            status: true,
                            expiresAt: true,
                        },
                    },
                    orderItems: {
                        select: {
                            variantId: true,
                            quantity: true,
                            variant: {
                                select: {
                                    productId: true,
                                },
                            },
                        },
                    },
                },
                orderBy: [
                    {
                        verificationQueuedAt: "asc",
                    },
                    {
                        orderDate: "asc",
                    },
                ],
            });
            const promotedOrderIds = [];
            for (const waitlisted of waitlistedOrders) {
                if (!waitlisted.transaction) {
                    continue;
                }
                const reserved = yield this.reserveStockForOrder(params.tx, waitlisted.orderItems);
                if (!reserved) {
                    continue;
                }
                const now = new Date();
                const expiresAt = new Date(now.getTime() + params.reservationExpiryHours * 60 * 60 * 1000);
                yield this.upsertActiveReservation({
                    tx: params.tx,
                    orderId: waitlisted.id,
                    expiresAt,
                });
                yield this.ensurePaymentRecord({
                    tx: params.tx,
                    order: {
                        id: waitlisted.id,
                        userId: waitlisted.userId,
                        amount: waitlisted.amount,
                        payment: waitlisted.payment,
                    },
                    status: client_1.PAYMENT_STATUS.PENDING,
                });
                yield params.tx.order.update({
                    where: {
                        id: waitlisted.id,
                    },
                    data: {
                        status: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT,
                        quotationSentAt: now,
                        paymentRequestedAt: now,
                        reservationExpiresAt: expiresAt,
                    },
                });
                yield params.tx.transaction.update({
                    where: {
                        id: waitlisted.transaction.id,
                    },
                    data: {
                        status: client_1.TRANSACTION_STATUS.AWAITING_PAYMENT,
                    },
                });
                promotedOrderIds.push(waitlisted.id);
            }
            return promotedOrderIds;
        });
    }
    updateTransaction(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c, _d;
                const existingTransaction = yield tx.transaction.findUnique({
                    where: { id },
                    select: {
                        id: true,
                        orderId: true,
                        status: true,
                    },
                });
                if (!existingTransaction) {
                    throw new AppError_1.default(404, "Transaction not found");
                }
                if (data.quotationItems !== undefined &&
                    Array.isArray(data.quotationItems) &&
                    data.quotationItems.length === 0) {
                    throw new AppError_1.default(400, "Quotation update payload cannot be an empty list.");
                }
                const previousStatus = this.normalizeStatusValue(String(existingTransaction.status));
                let order = yield this.getOrderSnapshot(tx, existingTransaction.orderId);
                const previousOrderAmount = Number(order.amount);
                if ((_a = data.quotationItems) === null || _a === void 0 ? void 0 : _a.length) {
                    yield this.applyQuotationAdjustments({
                        tx,
                        order,
                        quotationItems: data.quotationItems,
                    });
                    order = yield this.getOrderSnapshot(tx, order.id);
                }
                let effectiveStatus = data.status;
                let promotedOrderIds = [];
                const now = new Date();
                if (effectiveStatus === orderLifecycle_1.ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT) {
                    const reserved = yield this.reserveStockForOrder(tx, order.orderItems);
                    if (reserved) {
                        const expiresAt = new Date(now.getTime() + data.reservationExpiryHours * 60 * 60 * 1000);
                        yield this.upsertActiveReservation({
                            tx,
                            orderId: order.id,
                            expiresAt,
                        });
                        yield this.ensurePaymentRecord({
                            tx,
                            order: {
                                id: order.id,
                                userId: order.userId,
                                amount: order.amount,
                                payment: order.payment,
                            },
                            status: client_1.PAYMENT_STATUS.PENDING,
                        });
                        yield tx.order.update({
                            where: { id: order.id },
                            data: {
                                status: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT,
                                verificationQueuedAt: order.verificationQueuedAt || now,
                                quotationSentAt: now,
                                paymentRequestedAt: now,
                                reservationExpiresAt: expiresAt,
                            },
                        });
                        if ((_b = data.quotationItems) === null || _b === void 0 ? void 0 : _b.length) {
                            yield this.appendQuotationLog({
                                tx,
                                orderId: order.id,
                                event: client_1.ORDER_QUOTATION_LOG_EVENT.ADMIN_QUOTATION,
                                previousTotal: previousOrderAmount,
                                updatedTotal: Number(order.amount),
                                actorUserId: data.actorUserId,
                                actorRole: data.actorRole,
                                message: "Admin revised quotation and reserved stock. Awaiting customer payment.",
                                lineItems: this.buildQuotationLineItems(order.orderItems),
                            });
                        }
                    }
                    else {
                        effectiveStatus = orderLifecycle_1.ORDER_LIFECYCLE_STATUS.WAITLISTED;
                        yield tx.order.update({
                            where: { id: order.id },
                            data: {
                                status: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.WAITLISTED,
                                verificationQueuedAt: order.verificationQueuedAt || now,
                                reservationExpiresAt: null,
                            },
                        });
                        if ((_c = data.quotationItems) === null || _c === void 0 ? void 0 : _c.length) {
                            yield this.appendQuotationLog({
                                tx,
                                orderId: order.id,
                                event: client_1.ORDER_QUOTATION_LOG_EVENT.ADMIN_QUOTATION,
                                previousTotal: previousOrderAmount,
                                updatedTotal: Number(order.amount),
                                actorUserId: data.actorUserId,
                                actorRole: data.actorRole,
                                message: "Admin revised quotation, but stock is currently unavailable. Order moved to waitlist.",
                                lineItems: this.buildQuotationLineItems(order.orderItems),
                            });
                        }
                    }
                }
                else if (effectiveStatus === orderLifecycle_1.ORDER_LIFECYCLE_STATUS.WAITLISTED) {
                    if (((_d = order.reservation) === null || _d === void 0 ? void 0 : _d.status) === client_1.RESERVATION_STATUS.ACTIVE) {
                        yield this.releaseReservationStock({
                            tx,
                            order,
                            nextReservationStatus: client_1.RESERVATION_STATUS.RELEASED,
                            reason: "WAITLISTED",
                        });
                    }
                    yield tx.order.update({
                        where: { id: order.id },
                        data: {
                            status: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.WAITLISTED,
                            verificationQueuedAt: order.verificationQueuedAt || now,
                            reservationExpiresAt: null,
                        },
                    });
                }
                else if (effectiveStatus === orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED ||
                    effectiveStatus === orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_EXPIRED) {
                    const affectedVariantIds = yield this.releaseReservationStock({
                        tx,
                        order,
                        nextReservationStatus: effectiveStatus === orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_EXPIRED
                            ? client_1.RESERVATION_STATUS.EXPIRED
                            : client_1.RESERVATION_STATUS.RELEASED,
                        reason: effectiveStatus === orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_EXPIRED
                            ? "QUOTATION_EXPIRED"
                            : "QUOTATION_REJECTED",
                    });
                    yield this.ensurePaymentRecord({
                        tx,
                        order: {
                            id: order.id,
                            userId: order.userId,
                            amount: order.amount,
                            payment: order.payment,
                        },
                        status: client_1.PAYMENT_STATUS.CANCELED,
                    });
                    yield tx.order.update({
                        where: { id: order.id },
                        data: {
                            status: effectiveStatus,
                            reservationExpiresAt: null,
                        },
                    });
                    yield this.appendQuotationLog({
                        tx,
                        orderId: order.id,
                        event: effectiveStatus === orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_EXPIRED
                            ? client_1.ORDER_QUOTATION_LOG_EVENT.QUOTATION_EXPIRED
                            : client_1.ORDER_QUOTATION_LOG_EVENT.CUSTOMER_REJECTED,
                        previousTotal: Number(order.amount),
                        updatedTotal: Number(order.amount),
                        actorUserId: data.actorUserId,
                        actorRole: data.actorRole,
                        message: effectiveStatus === orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_EXPIRED
                            ? "Quotation expired before payment. Reservation released."
                            : data.actorRole
                                ? `Quotation rejected by ${data.actorRole}. Reservation released.`
                                : "Quotation rejected. Reservation released.",
                        lineItems: this.buildQuotationLineItems(order.orderItems),
                    });
                    promotedOrderIds = yield this.promoteWaitlistedOrders({
                        tx,
                        variantIds: affectedVariantIds,
                        reservationExpiryHours: data.reservationExpiryHours,
                    });
                }
                else if (effectiveStatus === orderLifecycle_1.ORDER_LIFECYCLE_STATUS.CONFIRMED) {
                    yield this.finalizePaidOrder({
                        tx,
                        order,
                    });
                    yield this.ensurePaymentRecord({
                        tx,
                        order: {
                            id: order.id,
                            userId: order.userId,
                            amount: order.amount,
                            payment: order.payment,
                        },
                        status: client_1.PAYMENT_STATUS.PAID,
                    });
                    yield tx.order.update({
                        where: { id: order.id },
                        data: {
                            status: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.CONFIRMED,
                            reservationExpiresAt: null,
                        },
                    });
                    yield this.appendQuotationLog({
                        tx,
                        orderId: order.id,
                        event: client_1.ORDER_QUOTATION_LOG_EVENT.PAYMENT_CONFIRMED,
                        previousTotal: Number(order.amount),
                        updatedTotal: Number(order.amount),
                        actorUserId: data.actorUserId,
                        actorRole: data.actorRole || "SYSTEM",
                        message: "Payment confirmed at accepted quotation price.",
                        lineItems: this.buildQuotationLineItems(order.orderItems),
                    });
                }
                else {
                    yield tx.order.update({
                        where: { id: order.id },
                        data: {
                            status: effectiveStatus,
                        },
                    });
                }
                const updatedTransaction = yield tx.transaction.update({
                    where: { id },
                    data: {
                        status: statusToPrismaEnum[effectiveStatus],
                    },
                    include: {
                        order: {
                            include: {
                                payment: true,
                                reservation: true,
                                quotationLogs: {
                                    orderBy: {
                                        createdAt: "desc",
                                    },
                                },
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
                        },
                    },
                });
                return {
                    transaction: updatedTransaction,
                    previousStatus,
                    effectiveStatus,
                    promotedOrderIds,
                };
            }));
        });
    }
    deleteTransaction(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.transaction.delete({
                where: { id },
            });
        });
    }
}
exports.TransactionRepository = TransactionRepository;
