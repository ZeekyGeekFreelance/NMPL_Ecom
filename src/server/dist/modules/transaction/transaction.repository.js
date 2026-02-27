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
const client_1 = require("@prisma/client");
const AppError_1 = __importDefault(require("@/shared/errors/AppError"));
const orderStatusByTransactionStatus = {
    PLACED: "PLACED",
    CONFIRMED: "CONFIRMED",
    REJECTED: "REJECTED",
    DELIVERED: "DELIVERED",
};
class TransactionRepository {
    constructor() { }
    normalizeStatusValue(status) {
        const normalized = status.toUpperCase();
        const legacyToCurrent = {
            PENDING: "PLACED",
            PROCESSING: "CONFIRMED",
            SHIPPED: "CONFIRMED",
            IN_TRANSIT: "CONFIRMED",
            CANCELED: "REJECTED",
            RETURNED: "REJECTED",
            REFUNDED: "REJECTED",
            CONFIRMED: "CONFIRMED",
            REJECTED: "REJECTED",
            PLACED: "PLACED",
            DELIVERED: "DELIVERED",
        };
        if (legacyToCurrent[normalized]) {
            return legacyToCurrent[normalized];
        }
        return "PLACED";
    }
    mapCurrentToLegacyStatus(status) {
        const currentToLegacy = {
            PLACED: "PENDING",
            CONFIRMED: "PROCESSING",
            REJECTED: "CANCELED",
            DELIVERED: "DELIVERED",
        };
        return currentToLegacy[status];
    }
    isLegacyEnumWriteError(error) {
        if (!(error instanceof Error)) {
            return false;
        }
        const message = error.message || "";
        return (message.includes('invalid input value for enum "TRANSACTION_STATUS"') ||
            message.includes("Inconsistent column data") ||
            message.includes("Invalid value for argument `status`") ||
            message.includes("Provided value") ||
            message.includes("Argument `status`"));
    }
    findMany() {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.transaction.findMany();
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
                            shipment: true,
                            user: true,
                            address: true,
                            invoice: true,
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
    createTransaction(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.transaction.create({
                data,
            });
        });
    }
    updateTransaction(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                const existingTransaction = yield tx.transaction.findUnique({
                    where: { id },
                    select: {
                        status: true,
                        orderId: true,
                        order: {
                            select: {
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
                        },
                    },
                });
                if (!existingTransaction) {
                    throw new AppError_1.default(404, "Transaction not found");
                }
                if (data.status === "REJECTED" &&
                    this.normalizeStatusValue(String(existingTransaction.status)) !==
                        "REJECTED") {
                    // Restore stock when a placed order is rejected by admin.
                    for (const item of existingTransaction.order.orderItems) {
                        yield tx.productVariant.update({
                            where: { id: item.variantId },
                            data: {
                                stock: { increment: item.quantity },
                            },
                        });
                        yield tx.product.update({
                            where: { id: item.variant.productId },
                            data: {
                                salesCount: { decrement: item.quantity },
                            },
                        });
                    }
                    yield tx.payment.updateMany({
                        where: {
                            orderId: existingTransaction.orderId,
                            status: client_1.PAYMENT_STATUS.PENDING,
                        },
                        data: {
                            status: client_1.PAYMENT_STATUS.CANCELED,
                        },
                    });
                }
                let updatedTransaction = null;
                try {
                    updatedTransaction = yield tx.transaction.update({
                        where: { id },
                        data: {
                            status: data.status,
                        },
                        include: {
                            order: {
                                include: {
                                    user: {
                                        select: {
                                            id: true,
                                            name: true,
                                            email: true,
                                            phone: true,
                                        },
                                    },
                                },
                            },
                        },
                    });
                }
                catch (error) {
                    if (!this.isLegacyEnumWriteError(error)) {
                        throw error;
                    }
                    const legacyStatus = this.mapCurrentToLegacyStatus(data.status);
                    yield tx.$executeRaw `
          UPDATE "Transaction"
          SET "status" = ${legacyStatus}::"TRANSACTION_STATUS",
              "updatedAt" = NOW()
          WHERE "id" = ${id}
        `;
                    updatedTransaction = yield tx.transaction.findUnique({
                        where: { id },
                        include: {
                            order: {
                                include: {
                                    user: {
                                        select: {
                                            id: true,
                                            name: true,
                                            email: true,
                                            phone: true,
                                        },
                                    },
                                },
                            },
                        },
                    });
                }
                if (!updatedTransaction) {
                    throw new AppError_1.default(404, "Transaction not found");
                }
                yield tx.order.update({
                    where: { id: updatedTransaction.orderId },
                    data: { status: orderStatusByTransactionStatus[data.status] },
                });
                return updatedTransaction;
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
