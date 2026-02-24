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
exports.InvoiceRepository = void 0;
const database_config_1 = __importDefault(require("@/infra/database/database.config"));
const client_1 = require("@prisma/client");
const invoiceWithDetailsInclude = {
    order: {
        include: {
            orderItems: {
                include: {
                    variant: {
                        include: {
                            product: true,
                        },
                    },
                },
            },
            payment: true,
            address: true,
            shipment: true,
            transaction: true,
        },
    },
    user: {
        include: {
            dealerProfile: true,
        },
    },
};
const orderInvoiceInclude = {
    user: {
        include: {
            dealerProfile: true,
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
    address: true,
    payment: true,
    transaction: true,
    invoice: true,
};
class InvoiceRepository {
    findAllInvoices() {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.invoice.findMany({
                orderBy: { createdAt: "desc" },
                include: {
                    order: {
                        select: {
                            id: true,
                            amount: true,
                            status: true,
                            orderDate: true,
                        },
                    },
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true,
                            dealerProfile: {
                                select: {
                                    status: true,
                                    businessName: true,
                                },
                            },
                        },
                    },
                },
            });
        });
    }
    findInvoicesByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.invoice.findMany({
                where: { userId },
                orderBy: { createdAt: "desc" },
                include: {
                    order: {
                        select: {
                            id: true,
                            amount: true,
                            status: true,
                            orderDate: true,
                        },
                    },
                },
            });
        });
    }
    findInvoiceById(invoiceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.invoice.findUnique({
                where: { id: invoiceId },
                include: invoiceWithDetailsInclude,
            });
        });
    }
    findInvoiceByOrderId(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.invoice.findUnique({
                where: { orderId },
                include: invoiceWithDetailsInclude,
            });
        });
    }
    findOrderForInvoice(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.order.findUnique({
                where: { id: orderId },
                include: orderInvoiceInclude,
            });
        });
    }
    ensureInvoiceRecord(data) {
        return __awaiter(this, void 0, void 0, function* () {
            for (let attempt = 0; attempt < 3; attempt += 1) {
                try {
                    return yield database_config_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                        const existing = yield tx.invoice.findUnique({
                            where: { orderId: data.orderId },
                            include: invoiceWithDetailsInclude,
                        });
                        if (existing) {
                            return existing;
                        }
                        const counter = yield tx.invoiceCounter.upsert({
                            where: { year: data.year },
                            create: {
                                year: data.year,
                                sequence: 1,
                            },
                            update: {
                                sequence: { increment: 1 },
                            },
                        });
                        const sequence = String(counter.sequence).padStart(4, "0");
                        const invoiceNumber = `INV-${data.year}-${sequence}`;
                        return tx.invoice.create({
                            data: {
                                orderId: data.orderId,
                                userId: data.userId,
                                customerEmail: data.customerEmail,
                                invoiceNumber,
                            },
                            include: invoiceWithDetailsInclude,
                        });
                    }));
                }
                catch (error) {
                    const isUniqueConflict = error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                        error.code === "P2002";
                    if (!isUniqueConflict || attempt === 2) {
                        throw error;
                    }
                }
            }
            throw new Error("Failed to generate invoice number after retries.");
        });
    }
    updateInvoiceEmailStatus(invoiceId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            yield database_config_1.default.invoice.update({
                where: { id: invoiceId },
                data,
            });
        });
    }
}
exports.InvoiceRepository = InvoiceRepository;
