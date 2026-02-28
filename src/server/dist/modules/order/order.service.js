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
exports.OrderService = void 0;
const AppError_1 = __importDefault(require("@/shared/errors/AppError"));
const database_config_1 = __importDefault(require("@/infra/database/database.config"));
const client_1 = require("@prisma/client");
const sendEmail_1 = __importDefault(require("@/shared/utils/sendEmail"));
const branding_1 = require("@/shared/utils/branding");
const accountReference_1 = require("@/shared/utils/accountReference");
const dateTime_1 = require("@/shared/utils/dateTime");
const logs_factory_1 = require("../logs/logs.factory");
const dealerAccess_1 = require("@/shared/utils/dealerAccess");
const userRole_1 = require("@/shared/utils/userRole");
const orderLifecycle_1 = require("@/shared/utils/orderLifecycle");
const stripe_1 = __importStar(require("@/infra/payment/stripe"));
const transaction_service_1 = require("../transaction/transaction.service");
const transaction_repository_1 = require("../transaction/transaction.repository");
class OrderService {
    constructor(orderRepository) {
        this.orderRepository = orderRepository;
        this.logsService = (0, logs_factory_1.makeLogsService)();
        this.transactionService = new transaction_service_1.TransactionService(new transaction_repository_1.TransactionRepository());
    }
    resolvePortalUrl() {
        const configuredUrl = process.env.CLIENT_URL ||
            process.env.CLIENT_URL_DEV ||
            process.env.CLIENT_URL_PROD ||
            "http://localhost:3000";
        return configuredUrl.replace(/\/+$/, "");
    }
    buildQuotationLogLineItems(orderItems = []) {
        return orderItems.map((item) => {
            var _a, _b, _c;
            return ({
                orderItemId: item.id,
                variantId: item.variantId,
                sku: ((_a = item.variant) === null || _a === void 0 ? void 0 : _a.sku) || null,
                productName: ((_c = (_b = item.variant) === null || _b === void 0 ? void 0 : _b.product) === null || _c === void 0 ? void 0 : _c.name) || "Product",
                quantity: Number(item.quantity) || 0,
                unitPrice: Number(item.price) || 0,
                lineTotal: Number(((Number(item.quantity) || 0) * (Number(item.price) || 0)).toFixed(2)),
            });
        });
    }
    createQuotationLog(params) {
        return __awaiter(this, void 0, void 0, function* () {
            yield database_config_1.default.orderQuotationLog.create({
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
    getAllOrders() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.orderRepository.findAllOrders();
        });
    }
    getUserOrders(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.orderRepository.findOrdersByUserId(userId);
        });
    }
    resolveOrderIdForUser(orderIdentifier, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const normalized = String(orderIdentifier || "").trim();
            if (!normalized) {
                throw new AppError_1.default(400, "Order ID is required");
            }
            if (!normalized.toUpperCase().startsWith("ORD-")) {
                return normalized;
            }
            const orderId = yield this.orderRepository.findOrderIdByReferenceForUser(normalized, userId);
            if (!orderId) {
                throw new AppError_1.default(404, "Order not found");
            }
            return orderId;
        });
    }
    getOrderDetails(orderId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const resolvedOrderId = yield this.resolveOrderIdForUser(orderId, userId);
            const order = yield this.orderRepository.findOrderById(resolvedOrderId);
            if (!order) {
                throw new AppError_1.default(404, "Order not found");
            }
            if (order.userId !== userId) {
                throw new AppError_1.default(403, "You are not authorized to view this order");
            }
            return order;
        });
    }
    acceptQuotationForOrder(orderId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            if (!stripe_1.isStripeConfigured || !stripe_1.default) {
                throw new AppError_1.default(503, "Payment gateway is not configured. Please contact support.");
            }
            const resolvedOrderId = yield this.resolveOrderIdForUser(orderId, userId);
            const order = yield this.orderRepository.findOrderById(resolvedOrderId);
            if (!order) {
                throw new AppError_1.default(404, "Order not found");
            }
            if (order.userId !== userId) {
                throw new AppError_1.default(403, "You are not authorized to update this order");
            }
            if (!order.transaction) {
                throw new AppError_1.default(409, "Quotation workflow is not initialized for this order.");
            }
            const normalizedStatus = String(order.transaction.status || order.status).toUpperCase();
            if (normalizedStatus !== orderLifecycle_1.ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT) {
                throw new AppError_1.default(409, `Payment can start only for AWAITING_PAYMENT orders. Current status: ${normalizedStatus}`);
            }
            const reservationExpiry = ((_a = order.reservation) === null || _a === void 0 ? void 0 : _a.expiresAt) || order.reservationExpiresAt || null;
            if (reservationExpiry && new Date(reservationExpiry).getTime() <= Date.now()) {
                yield this.transactionService
                    .updateTransactionStatus(order.transaction.id, {
                    status: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_EXPIRED,
                })
                    .catch(() => null);
                throw new AppError_1.default(409, "Quotation has expired. Please contact support for next steps.");
            }
            if (!Array.isArray(order.orderItems) || order.orderItems.length === 0) {
                throw new AppError_1.default(409, "Order has no line items to bill.");
            }
            if (!Number.isFinite(order.amount) || Number(order.amount) <= 0) {
                throw new AppError_1.default(409, "Quoted amount is invalid for online payment processing.");
            }
            const currency = (process.env.STRIPE_CURRENCY || "inr").toLowerCase();
            const lineItems = order.orderItems.map((item) => {
                var _a, _b, _c;
                return ({
                    quantity: item.quantity,
                    price_data: {
                        currency,
                        unit_amount: Math.round(item.price * 100),
                        product_data: {
                            name: ((_b = (_a = item.variant) === null || _a === void 0 ? void 0 : _a.product) === null || _b === void 0 ? void 0 : _b.name) || ((_c = item.variant) === null || _c === void 0 ? void 0 : _c.sku) || "Product",
                            metadata: {
                                orderId: order.id,
                                orderItemId: item.id,
                                variantId: item.variantId,
                            },
                        },
                    },
                });
            });
            const hasInvalidLineItem = lineItems.some((line) => !Number.isFinite(line.quantity) ||
                line.quantity <= 0 ||
                !Number.isFinite(line.price_data.unit_amount) ||
                line.price_data.unit_amount <= 0);
            if (hasInvalidLineItem) {
                throw new AppError_1.default(409, "Quoted line items contain invalid quantity or price.");
            }
            const portalUrl = this.resolvePortalUrl();
            const orderReference = (0, accountReference_1.toOrderReference)(order.id);
            const now = Date.now();
            const reservationExpiryTimestamp = reservationExpiry
                ? new Date(reservationExpiry).getTime()
                : null;
            const maxStripeCheckoutExpiry = now + 23 * 60 * 60 * 1000;
            const checkoutSessionExpiry = reservationExpiryTimestamp && reservationExpiryTimestamp > now + 5 * 60 * 1000
                ? Math.floor(Math.min(reservationExpiryTimestamp, maxStripeCheckoutExpiry) / 1000)
                : undefined;
            const checkoutSession = yield stripe_1.default.checkout.sessions.create(Object.assign({ mode: "payment", customer_email: ((_b = order.user) === null || _b === void 0 ? void 0 : _b.email) || undefined, line_items: lineItems, metadata: {
                    orderId: order.id,
                    orderReference,
                    userId,
                }, success_url: `${portalUrl}/payment-success?orderId=${orderReference}`, cancel_url: `${portalUrl}/cancel?orderId=${orderReference}` }, (checkoutSessionExpiry ? { expires_at: checkoutSessionExpiry } : {})));
            if (!checkoutSession.url) {
                throw new AppError_1.default(500, "Unable to initialize payment session. Please try again.");
            }
            if ((_c = order.payment) === null || _c === void 0 ? void 0 : _c.id) {
                yield database_config_1.default.payment.update({
                    where: {
                        id: order.payment.id,
                    },
                    data: {
                        method: "STRIPE_CHECKOUT",
                        amount: Number(order.amount),
                    },
                });
            }
            else {
                yield database_config_1.default.payment.create({
                    data: {
                        orderId: order.id,
                        userId: order.userId,
                        method: "STRIPE_CHECKOUT",
                        amount: Number(order.amount),
                        status: client_1.PAYMENT_STATUS.PENDING,
                    },
                });
            }
            yield this.createQuotationLog({
                orderId: order.id,
                event: client_1.ORDER_QUOTATION_LOG_EVENT.CUSTOMER_ACCEPTED,
                previousTotal: Number(order.amount),
                updatedTotal: Number(order.amount),
                actorUserId: userId,
                actorRole: order.customerRoleSnapshot,
                message: "Customer accepted quotation and initiated payment.",
                lineItems: this.buildQuotationLogLineItems(order.orderItems),
            });
            return {
                orderId: order.id,
                orderReference,
                checkoutUrl: checkoutSession.url,
                checkoutSessionId: checkoutSession.id,
                reservationExpiresAt: reservationExpiry,
            };
        });
    }
    rejectQuotationForOrder(orderId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const resolvedOrderId = yield this.resolveOrderIdForUser(orderId, userId);
            const order = yield this.orderRepository.findOrderById(resolvedOrderId);
            if (!order) {
                throw new AppError_1.default(404, "Order not found");
            }
            if (order.userId !== userId) {
                throw new AppError_1.default(403, "You are not authorized to update this order");
            }
            if (!order.transaction) {
                throw new AppError_1.default(409, "Quotation workflow is not initialized for this order.");
            }
            const normalizedStatus = String(order.transaction.status || order.status).toUpperCase();
            if (normalizedStatus !== orderLifecycle_1.ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT) {
                throw new AppError_1.default(409, `Only AWAITING_PAYMENT quotations can be rejected. Current status: ${normalizedStatus}`);
            }
            return this.transactionService.updateTransactionStatus(order.transaction.id, {
                status: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
                actorUserId: userId,
                actorRole: order.customerRoleSnapshot,
            });
        });
    }
    createOrderFromCart(userId, cartId) {
        return __awaiter(this, void 0, void 0, function* () {
            const orderingUser = yield database_config_1.default.user.findUnique({
                where: { id: userId },
                select: {
                    role: true,
                    dealerProfile: {
                        select: {
                            status: true,
                        },
                    },
                },
            });
            if (!orderingUser) {
                throw new AppError_1.default(404, "User not found");
            }
            const cart = yield database_config_1.default.cart.findUnique({
                where: { id: cartId },
                include: { cartItems: { include: { variant: { include: { product: true } } } } },
            });
            if (!cart || cart.cartItems.length === 0) {
                throw new AppError_1.default(400, "Cart is empty or not found");
            }
            if (cart.status !== client_1.CART_STATUS.ACTIVE) {
                throw new AppError_1.default(400, "Cart is not active");
            }
            if (cart.userId !== userId) {
                throw new AppError_1.default(403, "You are not authorized to access this cart");
            }
            const dealerPriceMap = yield (0, dealerAccess_1.getDealerPriceMap)(database_config_1.default, userId, cart.cartItems.map((item) => item.variantId));
            const customerRoleSnapshot = (0, userRole_1.resolveCustomerTypeFromUser)(orderingUser);
            const orderItems = cart.cartItems.map((item) => {
                var _a;
                return ({
                    variantId: item.variantId,
                    quantity: item.quantity,
                    price: (_a = dealerPriceMap.get(item.variantId)) !== null && _a !== void 0 ? _a : item.variant.price,
                });
            });
            const order = yield this.orderRepository.createOrder({
                userId,
                customerRoleSnapshot,
                cartId,
                orderItems,
            });
            yield this.sendOrderPlacedNotifications(userId, order.id, customerRoleSnapshot).catch((error) => __awaiter(this, void 0, void 0, function* () {
                const errorMessage = error instanceof Error ? error.message : "Unknown notification error";
                yield this.logsService.warn("Order placed notifications failed", {
                    userId,
                    orderId: order.id,
                    error: errorMessage,
                });
            }));
            return order;
        });
    }
    getAdminNotificationRecipients(excludeEmail) {
        return __awaiter(this, void 0, void 0, function* () {
            const admins = yield database_config_1.default.user.findMany({
                where: {
                    role: {
                        in: [client_1.ROLE.ADMIN, client_1.ROLE.SUPERADMIN],
                    },
                },
                select: {
                    email: true,
                },
            });
            const normalizedExclude = excludeEmail === null || excludeEmail === void 0 ? void 0 : excludeEmail.trim().toLowerCase();
            const emails = admins
                .map((admin) => { var _a; return (_a = admin.email) === null || _a === void 0 ? void 0 : _a.trim(); })
                .filter((email) => !!email)
                .filter((email) => email.toLowerCase() !== normalizedExclude);
            return Array.from(new Set(emails));
        });
    }
    sendOrderPlacedNotifications(userId, orderId, customerType) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield database_config_1.default.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            });
            if (!user) {
                return;
            }
            const platformName = (0, branding_1.getPlatformName)();
            const supportEmail = (0, branding_1.getSupportEmail)();
            const accountReference = (0, accountReference_1.toAccountReference)(user.id);
            const orderReference = (0, accountReference_1.toOrderReference)(orderId);
            const actionTime = (0, dateTime_1.formatDateTimeInIST)(new Date());
            const notificationPromises = [];
            if (user.email) {
                notificationPromises.push((0, sendEmail_1.default)({
                    to: user.email,
                    subject: `${platformName} | Order Received - Verification Pending`,
                    text: [
                        `Hello ${user.name},`,
                        "",
                        `Your order has been received on ${platformName}.`,
                        `Order ID: ${orderReference}`,
                        `Account Reference: ${accountReference}`,
                        `Current status: ${orderLifecycle_1.ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION}`,
                        `Action Time (IST): ${actionTime}`,
                        "",
                        "Stock will be verified. You will receive a quotation. Complete payment after approval to confirm your order.",
                        `Need help? Contact ${supportEmail}.`,
                    ].join("\n"),
                    html: `
            <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
              <p>Hello <strong>${user.name}</strong>,</p>
              <p>Your order has been received on <strong>${platformName}</strong>.</p>
              <p>
                <strong>Order ID:</strong> ${orderReference}<br />
                <strong>Account Reference:</strong> ${accountReference}<br />
                <strong>Current status:</strong> ${orderLifecycle_1.ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION}<br />
                <strong>Action Time (IST):</strong> ${actionTime}
              </p>
              <p>Stock will be verified. You will receive a quotation. Complete payment after approval to confirm your order.</p>
              <p>
                Need help? Contact
                <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>.
              </p>
            </div>
          `,
                }));
            }
            const adminRecipients = yield this.getAdminNotificationRecipients(user.email);
            for (const adminEmail of adminRecipients) {
                notificationPromises.push((0, sendEmail_1.default)({
                    to: adminEmail,
                    subject: `${platformName} | New Order Awaiting Verification`,
                    text: [
                        "New order received.",
                        "",
                        `Order ID: ${orderReference}`,
                        `Customer Name: ${user.name}`,
                        `Customer Email: ${user.email || "Not available"}`,
                        `Customer Type: ${customerType}`,
                        `Account Reference: ${accountReference}`,
                        `Current status: ${orderLifecycle_1.ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION}`,
                        `Action Time (IST): ${actionTime}`,
                        "",
                        `Please verify stock and send quotation from the admin panel.`,
                    ].join("\n"),
                    html: `
            <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
              <p><strong>New order received.</strong></p>
              <p>
                <strong>Order ID:</strong> ${orderReference}<br />
                <strong>Customer Name:</strong> ${user.name}<br />
                <strong>Customer Email:</strong> ${user.email || "Not available"}<br />
                <strong>Customer Type:</strong> ${customerType}<br />
                <strong>Account Reference:</strong> ${accountReference}<br />
                <strong>Current status:</strong> ${orderLifecycle_1.ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION}<br />
                <strong>Action Time (IST):</strong> ${actionTime}
              </p>
              <p>Please verify stock and send quotation from the admin panel.</p>
            </div>
          `,
                }));
            }
            if (!notificationPromises.length) {
                return;
            }
            const results = yield Promise.allSettled(notificationPromises);
            const hasFailure = results.some((result) => result.status === "rejected" ||
                (result.status === "fulfilled" && result.value === false));
            if (hasFailure) {
                throw new Error("One or more order placement notifications failed.");
            }
        });
    }
}
exports.OrderService = OrderService;
