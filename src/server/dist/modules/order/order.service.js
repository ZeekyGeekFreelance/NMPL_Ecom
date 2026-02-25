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
exports.OrderService = void 0;
const AppError_1 = __importDefault(require("@/shared/errors/AppError"));
const database_config_1 = __importDefault(require("@/infra/database/database.config"));
const client_1 = require("@prisma/client");
const sendEmail_1 = __importDefault(require("@/shared/utils/sendEmail"));
const branding_1 = require("@/shared/utils/branding");
const accountReference_1 = require("@/shared/utils/accountReference");
const dateTime_1 = require("@/shared/utils/dateTime");
const logs_factory_1 = require("../logs/logs.factory");
class OrderService {
    constructor(orderRepository) {
        this.orderRepository = orderRepository;
        this.logsService = (0, logs_factory_1.makeLogsService)();
    }
    isDealerTableMissing(error) {
        if (!(error instanceof Error)) {
            return false;
        }
        return (error.message.includes('relation "DealerProfile" does not exist') ||
            error.message.includes('relation "DealerPriceMapping" does not exist'));
    }
    getDealerPriceMap(userId, variantIds) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!variantIds.length) {
                return new Map();
            }
            try {
                const dealerProfileRows = yield database_config_1.default.$queryRaw(client_1.Prisma.sql `
          SELECT "status"
          FROM "DealerProfile"
          WHERE "userId" = ${userId}
          LIMIT 1
        `);
                if (!dealerProfileRows.length || dealerProfileRows[0].status !== "APPROVED") {
                    return new Map();
                }
                const priceRows = yield database_config_1.default.$queryRaw(client_1.Prisma.sql `
          SELECT "variantId", "customPrice"
          FROM "DealerPriceMapping"
          WHERE "dealerId" = ${userId}
            AND "variantId" IN (${client_1.Prisma.join(variantIds)})
        `);
                return new Map(priceRows.map((row) => [row.variantId, row.customPrice]));
            }
            catch (error) {
                if (this.isDealerTableMissing(error)) {
                    return new Map();
                }
                throw error;
            }
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
    getOrderDetails(orderId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const order = yield this.orderRepository.findOrderById(orderId);
            if (!order) {
                throw new AppError_1.default(404, "Order not found");
            }
            if (order.userId !== userId) {
                throw new AppError_1.default(403, "You are not authorized to view this order");
            }
            return order;
        });
    }
    createOrderFromCart(userId, cartId) {
        return __awaiter(this, void 0, void 0, function* () {
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
            const dealerPriceMap = yield this.getDealerPriceMap(userId, cart.cartItems.map((item) => item.variantId));
            const amount = cart.cartItems.reduce((sum, item) => {
                var _a;
                return sum +
                    item.quantity *
                        ((_a = dealerPriceMap.get(item.variantId)) !== null && _a !== void 0 ? _a : item.variant.price);
            }, 0);
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
                amount,
                cartId,
                orderItems,
            });
            yield this.sendOrderPlacedNotifications(userId, order.id).catch((error) => __awaiter(this, void 0, void 0, function* () {
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
    sendOrderPlacedNotifications(userId, orderId) {
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
                    subject: `${platformName} | Your Order Has Been Placed`,
                    text: [
                        `Hello ${user.name},`,
                        "",
                        `Your order has been placed on ${platformName}.`,
                        `Order ID: ${orderReference}`,
                        `Account Reference: ${accountReference}`,
                        `Current status: PLACED`,
                        `Action Time (IST): ${actionTime}`,
                        "",
                        "We will confirm your order after stock verification.",
                        `Need help? Contact ${supportEmail}.`,
                    ].join("\n"),
                    html: `
            <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
              <p>Hello <strong>${user.name}</strong>,</p>
              <p>Your order has been placed on <strong>${platformName}</strong>.</p>
              <p>
                <strong>Order ID:</strong> ${orderReference}<br />
                <strong>Account Reference:</strong> ${accountReference}<br />
                <strong>Current status:</strong> PLACED<br />
                <strong>Action Time (IST):</strong> ${actionTime}
              </p>
              <p>We will confirm your order after stock verification.</p>
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
                    subject: `${platformName} | New Order Arrived`,
                    text: [
                        "New order received.",
                        "",
                        `Order ID: ${orderReference}`,
                        `Customer Name: ${user.name}`,
                        `Customer Email: ${user.email || "Not available"}`,
                        `Account Reference: ${accountReference}`,
                        "Current status: PLACED",
                        `Action Time (IST): ${actionTime}`,
                        "",
                        `Please review and update status from the admin panel.`,
                    ].join("\n"),
                    html: `
            <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
              <p><strong>New order received.</strong></p>
              <p>
                <strong>Order ID:</strong> ${orderReference}<br />
                <strong>Customer Name:</strong> ${user.name}<br />
                <strong>Customer Email:</strong> ${user.email || "Not available"}<br />
                <strong>Account Reference:</strong> ${accountReference}<br />
                <strong>Current status:</strong> PLACED<br />
                <strong>Action Time (IST):</strong> ${actionTime}
              </p>
              <p>Please review and update status from the admin panel.</p>
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
