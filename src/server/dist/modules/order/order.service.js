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
const client_2 = require("@prisma/client");
const sendEmail_1 = __importDefault(require("@/shared/utils/sendEmail"));
const branding_1 = require("@/shared/utils/branding");
const accountReference_1 = require("@/shared/utils/accountReference");
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
                const dealerProfileRows = yield database_config_1.default.$queryRaw(client_2.Prisma.sql `
          SELECT "status"
          FROM "DealerProfile"
          WHERE "userId" = ${userId}
          LIMIT 1
        `);
                if (!dealerProfileRows.length || dealerProfileRows[0].status !== "APPROVED") {
                    return new Map();
                }
                const priceRows = yield database_config_1.default.$queryRaw(client_2.Prisma.sql `
          SELECT "variantId", "customPrice"
          FROM "DealerPriceMapping"
          WHERE "dealerId" = ${userId}
            AND "variantId" IN (${client_2.Prisma.join(variantIds)})
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
            yield this.sendOrderPlacedNotification(userId, order.id).catch((error) => __awaiter(this, void 0, void 0, function* () {
                const errorMessage = error instanceof Error ? error.message : "Unknown notification error";
                yield this.logsService.warn("Order placed email notification failed", {
                    userId,
                    orderId: order.id,
                    error: errorMessage,
                });
            }));
            return order;
        });
    }
    sendOrderPlacedNotification(userId, orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield database_config_1.default.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            });
            if (!(user === null || user === void 0 ? void 0 : user.email)) {
                return;
            }
            const platformName = (0, branding_1.getPlatformName)();
            const supportEmail = (0, branding_1.getSupportEmail)();
            const accountReference = (0, accountReference_1.toAccountReference)(user.id);
            const isSent = yield (0, sendEmail_1.default)({
                to: user.email,
                subject: `${platformName} | Order Placed`,
                text: [
                    `Hello ${user.name},`,
                    "",
                    `Your order has been placed on ${platformName}.`,
                    `Order ID: ${orderId}`,
                    `Account Reference: ${accountReference}`,
                    `Current status: Order Placed`,
                    "",
                    `We will confirm your order after stock verification.`,
                    `Need help? Contact ${supportEmail}.`,
                ].join("\n"),
                html: `
        <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
          <p>Hello <strong>${user.name}</strong>,</p>
          <p>Your order has been placed on <strong>${platformName}</strong>.</p>
          <p>
            <strong>Order ID:</strong> ${orderId}<br />
            <strong>Account Reference:</strong> ${accountReference}<br />
            <strong>Current status:</strong> Order Placed
          </p>
          <p>We will confirm your order after stock verification.</p>
          <p>
            Need help? Contact
            <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>.
          </p>
        </div>
      `,
            });
            if (!isSent) {
                throw new Error("Failed to send order placed notification email.");
            }
        });
    }
}
exports.OrderService = OrderService;
