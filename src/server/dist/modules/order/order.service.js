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
const checkoutPricing_1 = require("@/shared/utils/pricing/checkoutPricing");
const config_1 = require("@/config");
class OrderService {
    constructor(orderRepository) {
        this.orderRepository = orderRepository;
        this.logsService = (0, logs_factory_1.makeLogsService)();
        this.transactionService = new transaction_service_1.TransactionService(new transaction_repository_1.TransactionRepository());
    }
    resolvePortalUrl() {
        const configuredUrl = config_1.config.isProduction
            ? config_1.config.urls.clientProd
            : config_1.config.urls.clientDev;
        return configuredUrl.replace(/\/+$/, "");
    }
    isMockPaymentEnabled() {
        return config_1.config.payment.enableMockPayment && !config_1.config.isProduction;
    }
    buildMockCheckoutUrl(orderReference) {
        const params = new URLSearchParams({
            orderId: orderReference,
            mockPayment: "1",
        });
        return `${this.resolvePortalUrl()}/payment-success?${params.toString()}`;
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
            var _a, _b, _c, _d;
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
            const mockPaymentEnabled = this.isMockPaymentEnabled();
            if (mockPaymentEnabled) {
                const orderReference = (0, accountReference_1.toOrderReference)(order.id);
                const mockCheckoutSessionId = `mock_${Date.now()}_${order.id.slice(0, 8)}`;
                if ((_b = order.payment) === null || _b === void 0 ? void 0 : _b.id) {
                    yield database_config_1.default.payment.update({
                        where: {
                            id: order.payment.id,
                        },
                        data: {
                            method: "MOCK_GATEWAY",
                            amount: Number(order.amount),
                            status: client_1.PAYMENT_STATUS.PENDING,
                        },
                    });
                }
                else {
                    yield database_config_1.default.payment.create({
                        data: {
                            orderId: order.id,
                            userId: order.userId,
                            method: "MOCK_GATEWAY",
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
                    message: "Customer accepted quotation and initiated mock payment for testing.",
                    lineItems: this.buildQuotationLogLineItems(order.orderItems),
                });
                yield this.transactionService.updateTransactionStatus(order.transaction.id, {
                    status: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.CONFIRMED,
                    actorUserId: userId,
                    actorRole: "SYSTEM",
                });
                yield this.logsService.info("Mock payment flow confirmed order", {
                    orderId: order.id,
                    orderReference,
                    userId,
                    checkoutSessionId: mockCheckoutSessionId,
                });
                return {
                    orderId: order.id,
                    orderReference,
                    checkoutUrl: this.buildMockCheckoutUrl(orderReference),
                    checkoutSessionId: mockCheckoutSessionId,
                    reservationExpiresAt: reservationExpiry,
                    isMockPayment: true,
                };
            }
            if (!stripe_1.isStripeConfigured || !stripe_1.default) {
                throw new AppError_1.default(503, "Payment gateway is not configured. Please contact support.");
            }
            const currency = config_1.config.payment.stripeCurrency.toLowerCase();
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
            const checkoutSession = yield stripe_1.default.checkout.sessions.create(Object.assign({ mode: "payment", customer_email: ((_c = order.user) === null || _c === void 0 ? void 0 : _c.email) || undefined, line_items: lineItems, metadata: {
                    orderId: order.id,
                    orderReference,
                    userId,
                }, success_url: `${portalUrl}/payment-success?orderId=${orderReference}`, cancel_url: `${portalUrl}/cancel?orderId=${orderReference}` }, (checkoutSessionExpiry ? { expires_at: checkoutSessionExpiry } : {})));
            if (!checkoutSession.url) {
                throw new AppError_1.default(500, "Unable to initialize payment session. Please try again.");
            }
            if ((_d = order.payment) === null || _d === void 0 ? void 0 : _d.id) {
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
    buildCheckoutOrderDraft(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const orderingUser = yield database_config_1.default.user.findUnique({
                where: { id: params.userId },
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
            const cart = params.cartId
                ? yield database_config_1.default.cart.findUnique({
                    where: { id: params.cartId },
                    include: {
                        cartItems: { include: { variant: { include: { product: true } } } },
                    },
                })
                : yield database_config_1.default.cart.findFirst({
                    where: {
                        userId: params.userId,
                        status: client_1.CART_STATUS.ACTIVE,
                    },
                    include: {
                        cartItems: { include: { variant: { include: { product: true } } } },
                    },
                    orderBy: {
                        updatedAt: "desc",
                    },
                });
            if (!cart || cart.cartItems.length === 0) {
                throw new AppError_1.default(400, "Cart is empty or not found");
            }
            if (cart.status !== client_1.CART_STATUS.ACTIVE) {
                throw new AppError_1.default(400, "Cart is not active");
            }
            if (cart.userId !== params.userId) {
                throw new AppError_1.default(403, "You are not authorized to access this cart");
            }
            const dealerPriceMap = yield (0, dealerAccess_1.getDealerPriceMap)(database_config_1.default, params.userId, cart.cartItems.map((item) => item.variantId));
            const customerRoleSnapshot = (0, userRole_1.resolveCustomerTypeFromUser)(orderingUser);
            const orderItems = cart.cartItems.map((item) => {
                var _a;
                return ({
                    variantId: item.variantId,
                    quantity: item.quantity,
                    price: (_a = dealerPriceMap.get(item.variantId)) !== null && _a !== void 0 ? _a : item.variant.price,
                });
            });
            const normalizedDeliveryMode = String(params.deliveryMode || "").toUpperCase() === client_1.DELIVERY_MODE.PICKUP
                ? client_1.DELIVERY_MODE.PICKUP
                : client_1.DELIVERY_MODE.DELIVERY;
            const selectedAddress = normalizedDeliveryMode === client_1.DELIVERY_MODE.PICKUP
                ? (0, checkoutPricing_1.getPickupLocationSnapshot)()
                : yield (0, checkoutPricing_1.getAddressForCheckout)(params.userId, params.addressId || "");
            const deliveryQuote = yield (0, checkoutPricing_1.resolveDeliveryQuote)({
                deliveryMode: normalizedDeliveryMode,
                address: selectedAddress,
            });
            const pricing = (0, checkoutPricing_1.buildCheckoutPricing)({
                items: orderItems.map((item) => ({
                    quantity: item.quantity,
                    price: item.price,
                })),
                deliveryQuote,
            });
            return {
                cart,
                customerRoleSnapshot,
                orderItems,
                selectedAddress,
                pricing,
            };
        });
    }
    buildCheckoutSummaryFromUserCart(userId, addressId, deliveryMode) {
        return __awaiter(this, void 0, void 0, function* () {
            const draft = yield this.buildCheckoutOrderDraft({
                userId,
                addressId,
                deliveryMode,
            });
            return {
                cartId: draft.cart.id,
                subtotalAmount: draft.pricing.subtotalAmount,
                deliveryMode: draft.pricing.deliveryMode,
                deliveryLabel: draft.pricing.deliveryLabel,
                deliveryCharge: draft.pricing.deliveryCharge,
                finalTotal: draft.pricing.finalTotal,
                serviceArea: draft.pricing.serviceArea,
                selectedAddress: {
                    id: draft.selectedAddress.id,
                    type: draft.selectedAddress.type,
                    fullName: draft.selectedAddress.fullName,
                    phoneNumber: draft.selectedAddress.phoneNumber,
                    line1: draft.selectedAddress.line1,
                    line2: draft.selectedAddress.line2,
                    landmark: draft.selectedAddress.landmark,
                    city: draft.selectedAddress.city,
                    state: draft.selectedAddress.state,
                    country: draft.selectedAddress.country,
                    pincode: draft.selectedAddress.pincode,
                },
            };
        });
    }
    createOrderFromCart(userId, cartId, addressId, deliveryMode) {
        return __awaiter(this, void 0, void 0, function* () {
            const draft = yield this.buildCheckoutOrderDraft({
                userId,
                cartId,
                addressId,
                deliveryMode,
            });
            const order = yield this.orderRepository.createOrder({
                userId,
                customerRoleSnapshot: draft.customerRoleSnapshot,
                cartId: draft.cart.id,
                orderItems: draft.orderItems,
                pricing: {
                    subtotalAmount: draft.pricing.subtotalAmount,
                    deliveryCharge: draft.pricing.deliveryCharge,
                    deliveryMode: draft.pricing.deliveryMode,
                    deliveryLabel: draft.pricing.deliveryLabel,
                    serviceArea: draft.pricing.serviceArea,
                },
                addressSnapshot: {
                    sourceAddressId: draft.selectedAddress.sourceAddressId || undefined,
                    addressType: draft.selectedAddress.type,
                    fullName: draft.selectedAddress.fullName,
                    phoneNumber: draft.selectedAddress.phoneNumber,
                    line1: draft.selectedAddress.line1,
                    line2: draft.selectedAddress.line2,
                    landmark: draft.selectedAddress.landmark,
                    city: draft.selectedAddress.city,
                    state: draft.selectedAddress.state,
                    country: draft.selectedAddress.country,
                    pincode: draft.selectedAddress.pincode,
                },
            });
            yield this.sendOrderPlacedNotifications(userId, order.id, draft.customerRoleSnapshot).catch((error) => __awaiter(this, void 0, void 0, function* () {
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
            var _a, _b, _c, _d;
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
            const order = yield database_config_1.default.order.findUnique({
                where: { id: orderId },
                select: {
                    subtotalAmount: true,
                    deliveryCharge: true,
                    deliveryMode: true,
                    amount: true,
                    address: {
                        select: {
                            deliveryLabel: true,
                        },
                    },
                },
            });
            if (!order) {
                return;
            }
            const platformName = (0, branding_1.getPlatformName)();
            const supportEmail = (0, branding_1.getSupportEmail)();
            const accountReference = (0, accountReference_1.toAccountReference)(user.id);
            const orderReference = (0, accountReference_1.toOrderReference)(orderId);
            const actionTime = (0, dateTime_1.formatDateTimeInIST)(new Date());
            const formatCurrency = (value) => new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: "INR",
            }).format(Number(value || 0));
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
                        `Subtotal: ${formatCurrency(order.subtotalAmount)}`,
                        `Delivery (${((_a = order.address) === null || _a === void 0 ? void 0 : _a.deliveryLabel) || order.deliveryMode}): ${formatCurrency(order.deliveryCharge)}`,
                        `Final Total: ${formatCurrency(order.amount)}`,
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
                <strong>Action Time (IST):</strong> ${actionTime}<br />
                <strong>Subtotal:</strong> ${formatCurrency(order.subtotalAmount)}<br />
                <strong>Delivery (${((_b = order.address) === null || _b === void 0 ? void 0 : _b.deliveryLabel) || order.deliveryMode}):</strong> ${formatCurrency(order.deliveryCharge)}<br />
                <strong>Final Total:</strong> ${formatCurrency(order.amount)}
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
                        `Subtotal: ${formatCurrency(order.subtotalAmount)}`,
                        `Delivery (${((_c = order.address) === null || _c === void 0 ? void 0 : _c.deliveryLabel) || order.deliveryMode}): ${formatCurrency(order.deliveryCharge)}`,
                        `Final Total: ${formatCurrency(order.amount)}`,
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
                <strong>Action Time (IST):</strong> ${actionTime}<br />
                <strong>Subtotal:</strong> ${formatCurrency(order.subtotalAmount)}<br />
                <strong>Delivery (${((_d = order.address) === null || _d === void 0 ? void 0 : _d.deliveryLabel) || order.deliveryMode}):</strong> ${formatCurrency(order.deliveryCharge)}<br />
                <strong>Final Total:</strong> ${formatCurrency(order.amount)}
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
