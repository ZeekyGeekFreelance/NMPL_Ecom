"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.WebhookService = void 0;
const stripe_1 = __importStar(require("@/infra/payment/stripe"));
const AppError_1 = __importDefault(require("@/shared/errors/AppError"));
const logs_factory_1 = require("../logs/logs.factory");
const database_config_1 = __importDefault(require("@/infra/database/database.config"));
const transaction_repository_1 = require("../transaction/transaction.repository");
const transaction_service_1 = require("../transaction/transaction.service");
const orderLifecycle_1 = require("@/shared/utils/orderLifecycle");
class WebhookService {
    constructor() {
        this.logsService = (0, logs_factory_1.makeLogsService)();
        this.transactionService = new transaction_service_1.TransactionService(new transaction_repository_1.TransactionRepository());
    }
    handleCheckoutCompletion(session) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            if (!stripe_1.isStripeConfigured || !stripe_1.default) {
                throw new AppError_1.default(503, "Stripe is not configured.");
            }
            const fullSession = yield stripe_1.default.checkout.sessions.retrieve(session.id, {
                expand: ["customer_details", "line_items"],
            });
            const orderId = (_a = fullSession === null || fullSession === void 0 ? void 0 : fullSession.metadata) === null || _a === void 0 ? void 0 : _a.orderId;
            if (!orderId) {
                throw new AppError_1.default(400, "Missing orderId in checkout metadata. Direct payment confirmation is not allowed.");
            }
            const transaction = yield database_config_1.default.transaction.findUnique({
                where: {
                    orderId,
                },
                include: {
                    order: {
                        select: {
                            id: true,
                            amount: true,
                        },
                    },
                },
            });
            if (!transaction) {
                throw new AppError_1.default(404, "Transaction not found for this order.");
            }
            const currentStatus = String(transaction.status || "").toUpperCase();
            if (currentStatus === orderLifecycle_1.ORDER_LIFECYCLE_STATUS.CONFIRMED ||
                currentStatus === orderLifecycle_1.ORDER_LIFECYCLE_STATUS.DELIVERED) {
                yield this.logsService.info("Webhook - Duplicate confirmation ignored", {
                    sessionId: session.id,
                    orderId,
                    transactionId: transaction.id,
                });
                return {
                    transaction,
                };
            }
            if (currentStatus !== orderLifecycle_1.ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT) {
                throw new AppError_1.default(409, `Payment cannot confirm order in ${currentStatus} status.`);
            }
            const amountInSession = ((_b = fullSession.amount_total) !== null && _b !== void 0 ? _b : 0) / 100;
            if (transaction.order &&
                Math.abs(transaction.order.amount - amountInSession) > 0.01) {
                throw new AppError_1.default(400, "Amount mismatch between quotation and payment.");
            }
            yield database_config_1.default.payment.updateMany({
                where: {
                    orderId,
                },
                data: {
                    method: ((_c = fullSession.payment_method_types) === null || _c === void 0 ? void 0 : _c[0]) || "STRIPE",
                },
            });
            const updatedTransaction = yield this.transactionService.updateTransactionStatus(transaction.id, {
                status: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.CONFIRMED,
                actorRole: "SYSTEM",
            });
            yield this.logsService.info("Webhook - Payment confirmed order", {
                sessionId: session.id,
                orderId,
                transactionId: transaction.id,
                finalStatus: updatedTransaction.status,
            });
            return {
                transaction: updatedTransaction,
            };
        });
    }
}
exports.WebhookService = WebhookService;
