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
exports.TransactionService = void 0;
const AppError_1 = __importDefault(require("@/shared/errors/AppError"));
const invoice_factory_1 = require("../invoice/invoice.factory");
const logs_factory_1 = require("../logs/logs.factory");
const accountReference_1 = require("@/shared/utils/accountReference");
const sendEmail_1 = __importDefault(require("@/shared/utils/sendEmail"));
const branding_1 = require("@/shared/utils/branding");
const allowedStatusTransitions = {
    PLACED: ["CONFIRMED", "REJECTED"],
    CONFIRMED: ["DELIVERED", "REJECTED"],
    REJECTED: [],
    DELIVERED: [],
};
const userFacingStatusLabel = {
    PLACED: "Placed",
    CONFIRMED: "Confirmed",
    REJECTED: "Rejected",
    DELIVERED: "Delivered",
};
const statusEmailSubjectLine = {
    PLACED: "Your Order Has Been Placed",
    CONFIRMED: "Your Order Has Been Confirmed",
    REJECTED: "Your Order Has Been Rejected",
    DELIVERED: "Your Order Has Been Delivered",
};
class TransactionService {
    constructor(transactionRepository) {
        this.transactionRepository = transactionRepository;
        this.logsService = (0, logs_factory_1.makeLogsService)();
        this.invoiceService = (0, invoice_factory_1.makeInvoiceService)();
    }
    parseStatus(value) {
        const normalized = value.trim().toUpperCase();
        const compact = normalized.replace(/[^A-Z]/g, "");
        const statusAliasMap = {
            PLACED: "PLACED",
            PLACE: "PLACED",
            ORDERPLACED: "PLACED",
            PENDING: "PLACED",
            CONFIRMED: "CONFIRMED",
            CONFIRM: "CONFIRMED",
            CONFIRMORDER: "CONFIRMED",
            PROCESSING: "CONFIRMED",
            SHIPPED: "CONFIRMED",
            INTRANSIT: "CONFIRMED",
            REJECTED: "REJECTED",
            REJECT: "REJECTED",
            REJECTORDER: "REJECTED",
            CANCELED: "REJECTED",
            CANCELLED: "REJECTED",
            RETURNED: "REJECTED",
            REFUNDED: "REJECTED",
            DELIVERED: "DELIVERED",
            DELIVER: "DELIVERED",
        };
        const mapped = statusAliasMap[compact] || statusAliasMap[normalized];
        if (mapped) {
            return mapped;
        }
        throw new AppError_1.default(400, `Invalid status value: ${value}`);
    }
    assertValidStatusTransition(currentStatus, nextStatus) {
        if (currentStatus === nextStatus) {
            return;
        }
        const allowed = allowedStatusTransitions[currentStatus] || [];
        if (!allowed.includes(nextStatus)) {
            throw new AppError_1.default(400, `Invalid status transition from ${currentStatus} to ${nextStatus}`);
        }
    }
    notifyOrderStatusChange(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const platformName = (0, branding_1.getPlatformName)();
            const supportEmail = (0, branding_1.getSupportEmail)();
            const currentLabel = userFacingStatusLabel[params.nextStatus];
            const previousLabel = userFacingStatusLabel[params.previousStatus];
            const subjectLine = statusEmailSubjectLine[params.nextStatus];
            const isSent = yield (0, sendEmail_1.default)({
                to: params.recipientEmail,
                subject: `${platformName} | ${subjectLine}`,
                text: [
                    `Hello ${params.recipientName},`,
                    "",
                    `Your order has been updated on ${platformName}.`,
                    `Order ID: ${params.orderId}`,
                    `Account Reference: ${params.accountReference}`,
                    `Previous status: ${previousLabel.toUpperCase()}`,
                    `Current status: ${currentLabel.toUpperCase()}`,
                    "",
                    `For support, contact ${supportEmail}.`,
                ].join("\n"),
                html: `
        <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
          <p>Hello <strong>${params.recipientName}</strong>,</p>
          <p>Your order has been updated on <strong>${platformName}</strong>.</p>
          <p>
            <strong>Order ID:</strong> ${params.orderId}<br />
            <strong>Account Reference:</strong> ${params.accountReference}<br />
            <strong>Previous status:</strong> ${previousLabel.toUpperCase()}<br />
            <strong>Current status:</strong> ${currentLabel.toUpperCase()}
          </p>
          <p>
            For support, contact
            <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>.
          </p>
        </div>
      `,
            });
            if (!isSent) {
                throw new Error("Order status notification email failed to send.");
            }
        });
    }
    getAllTransactions() {
        return __awaiter(this, void 0, void 0, function* () {
            const transactions = yield this.transactionRepository.findMany();
            return transactions;
        });
    }
    getTransactionById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const transaction = yield this.transactionRepository.findById(id);
            if (!transaction) {
                throw new AppError_1.default(404, "Transaction not found");
            }
            const userId = (_b = (_a = transaction.order) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id;
            if (!userId) {
                return transaction;
            }
            return Object.assign(Object.assign({}, transaction), { order: Object.assign(Object.assign({}, transaction.order), { user: Object.assign(Object.assign({}, transaction.order.user), { accountReference: (0, accountReference_1.toAccountReference)(userId) }) }) });
        });
    }
    updateTransactionStatus(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            const existingTransaction = yield this.transactionRepository.findById(id);
            if (!existingTransaction) {
                throw new AppError_1.default(404, "Transaction not found");
            }
            const previousStatus = this.parseStatus(String(existingTransaction.status));
            const nextStatus = this.parseStatus(String(data.status));
            const requiresConfirmedRejectionSafeguard = previousStatus === "CONFIRMED" && nextStatus === "REJECTED";
            if (requiresConfirmedRejectionSafeguard &&
                (!data.forceConfirmedRejection ||
                    data.confirmationToken !== "CONFIRMED_ORDER_REJECTION")) {
                throw new AppError_1.default(409, "This order has already been confirmed. Rejection requires additional confirmation.");
            }
            this.assertValidStatusTransition(previousStatus, nextStatus);
            if (previousStatus === nextStatus) {
                return existingTransaction;
            }
            const transaction = yield this.transactionRepository.updateTransaction(id, {
                status: nextStatus,
            });
            const recipientEmail = (_b = (_a = transaction.order) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.email;
            const recipientName = ((_d = (_c = transaction.order) === null || _c === void 0 ? void 0 : _c.user) === null || _d === void 0 ? void 0 : _d.name) || "Customer";
            const recipientUserId = (_f = (_e = transaction.order) === null || _e === void 0 ? void 0 : _e.user) === null || _f === void 0 ? void 0 : _f.id;
            if (recipientEmail && recipientUserId) {
                yield this.notifyOrderStatusChange({
                    recipientEmail,
                    recipientName,
                    accountReference: (0, accountReference_1.toAccountReference)(recipientUserId),
                    orderId: transaction.orderId,
                    previousStatus,
                    nextStatus,
                }).catch((error) => __awaiter(this, void 0, void 0, function* () {
                    const errorMessage = error instanceof Error ? error.message : "Unknown email error";
                    yield this.logsService.warn("Order status notification email failed", {
                        transactionId: id,
                        orderId: transaction.orderId,
                        error: errorMessage,
                    });
                }));
            }
            if (previousStatus === "PLACED" &&
                nextStatus === "CONFIRMED") {
                this.invoiceService
                    .generateAndSendInvoiceForOrder(transaction.orderId)
                    .catch((error) => __awaiter(this, void 0, void 0, function* () {
                    if (this.invoiceService.isInvoiceTableMissing(error)) {
                        yield this.logsService.warn("Invoice table is missing. Skipping automated billing after order confirmation.", { orderId: transaction.orderId });
                        return;
                    }
                    const errorMessage = error instanceof Error ? error.message : "Unknown invoice error";
                    yield this.logsService.error("Automated invoice generation failed after order confirmation", {
                        orderId: transaction.orderId,
                        transactionId: id,
                        error: errorMessage,
                    });
                }));
            }
            return transaction;
        });
    }
    deleteTransaction(id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.transactionRepository.deleteTransaction(id);
        });
    }
}
exports.TransactionService = TransactionService;
