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
exports.CartService = void 0;
const AppError_1 = __importDefault(require("@/shared/errors/AppError"));
const database_config_1 = __importDefault(require("@/infra/database/database.config"));
const client_1 = require("@prisma/client");
const isDevelopment = process.env.NODE_ENV !== "production";
const debugLog = (...args) => {
    if (isDevelopment) {
        console.log(...args);
    }
};
class CartService {
    constructor(cartRepository) {
        this.cartRepository = cartRepository;
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
            if (!userId || !variantIds.length) {
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
    applyDealerPricingToCart(cart, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!userId || !((_a = cart === null || cart === void 0 ? void 0 : cart.cartItems) === null || _a === void 0 ? void 0 : _a.length)) {
                return cart;
            }
            const variantIds = cart.cartItems.map((item) => item.variantId);
            const dealerPriceMap = yield this.getDealerPriceMap(userId, variantIds);
            if (!dealerPriceMap.size) {
                return cart;
            }
            cart.cartItems = cart.cartItems.map((item) => {
                var _a;
                return (Object.assign(Object.assign({}, item), { variant: Object.assign(Object.assign({}, item.variant), { price: (_a = dealerPriceMap.get(item.variantId)) !== null && _a !== void 0 ? _a : item.variant.price }) }));
            });
            return cart;
        });
    }
    getOrCreateCart(userId, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            debugLog("[CART SERVICE] getOrCreateCart called", { userId, sessionId });
            let cart;
            if (userId) {
                cart = yield this.cartRepository.getCartByUserId(userId);
                if (!cart) {
                    cart = yield this.cartRepository.createCart({ userId });
                }
                if (sessionId) {
                    const sessionCart = yield this.cartRepository.getCartBySessionId(sessionId);
                    if (sessionCart && sessionCart.id !== cart.id) {
                        yield this.cartRepository.mergeCarts(sessionCart.id, cart.id);
                        cart = yield this.cartRepository.getCartByUserId(userId);
                        if (!cart) {
                            throw new AppError_1.default(500, "Failed to load merged cart");
                        }
                    }
                }
            }
            else if (sessionId) {
                cart = yield this.cartRepository.getCartBySessionId(sessionId);
                if (!cart) {
                    cart = yield this.cartRepository.createCart({ sessionId });
                }
            }
            else {
                throw new AppError_1.default(400, "User ID or Session ID is required");
            }
            return this.applyDealerPricingToCart(cart, userId);
        });
    }
    logCartEvent(cartId, eventType, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield database_config_1.default.cartEvent.create({
                data: {
                    userId,
                    cartId,
                    eventType,
                },
            });
        });
    }
    getAbandonedCartMetrics(startDate, endDate) {
        return __awaiter(this, void 0, void 0, function* () {
            const cartEvents = yield database_config_1.default.cartEvent.findMany({
                where: {
                    timestamp: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                include: {
                    cart: {
                        include: { cartItems: { include: { variant: true } } },
                    },
                    user: true,
                },
            });
            const cartEventsByCartId = cartEvents.reduce((acc, event) => {
                if (!acc[event.cartId])
                    acc[event.cartId] = [];
                acc[event.cartId].push(event);
                return acc;
            }, {});
            let totalCarts = 0;
            let totalAbandonedCarts = 0;
            let potentialRevenueLost = 0;
            for (const cartId in cartEventsByCartId) {
                const events = cartEventsByCartId[cartId];
                const hasAddToCart = events.some((e) => e.eventType === "ADD");
                const hasCheckoutCompleted = events.some((e) => e.eventType === "CHECKOUT_COMPLETED");
                const cart = events[0].cart;
                if (!cart || !cart.cartItems || cart.cartItems.length === 0)
                    continue;
                totalCarts++;
                if (hasAddToCart && !hasCheckoutCompleted) {
                    const addToCartEvent = events.find((e) => e.eventType === "ADD");
                    const oneHourLater = new Date(addToCartEvent.timestamp.getTime() + 60 * 60 * 1000);
                    const now = new Date();
                    if (now > oneHourLater) {
                        totalAbandonedCarts++;
                        potentialRevenueLost += cart.cartItems.reduce((sum, item) => sum + item.quantity * item.variant.price, 0);
                    }
                }
            }
            const abandonmentRate = totalCarts > 0 ? (totalAbandonedCarts / totalCarts) * 100 : 0;
            return {
                totalAbandonedCarts,
                abandonmentRate,
                potentialRevenueLost,
            };
        });
    }
    getCartCount(userId, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const cart = yield this.getOrCreateCart(userId, sessionId);
            return cart.cartItems.length;
        });
    }
    addToCart(variantId, quantity, userId, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (quantity <= 0) {
                throw new AppError_1.default(400, "Quantity must be greater than 0");
            }
            const cart = yield this.getOrCreateCart(userId, sessionId);
            const existingItem = yield this.cartRepository.findCartItem(cart.id, variantId);
            if (existingItem) {
                const newQuantity = existingItem.quantity + quantity;
                const updatedItem = yield this.cartRepository.updateCartItemQuantity(existingItem.id, newQuantity);
                yield this.logCartEvent(cart.id, "ADD", userId);
                return updatedItem;
            }
            const item = yield this.cartRepository.addItemToCart({
                cartId: cart.id,
                variantId,
                quantity,
            });
            yield this.logCartEvent(cart.id, "ADD", userId);
            return item;
        });
    }
    assertCartItemOwnership(itemId, userId, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const cartItem = yield this.cartRepository.findCartItemById(itemId);
            if (!cartItem) {
                throw new AppError_1.default(404, "Cart item not found");
            }
            const isUserCart = !!userId && cartItem.cart.userId === userId;
            const isSessionCart = !!sessionId && cartItem.cart.sessionId === sessionId;
            if (!isUserCart && !isSessionCart) {
                throw new AppError_1.default(403, "You are not authorized to access this cart");
            }
        });
    }
    updateCartItemQuantity(itemId, quantity, userId, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (quantity <= 0) {
                throw new AppError_1.default(400, "Quantity must be greater than 0");
            }
            yield this.assertCartItemOwnership(itemId, userId, sessionId);
            return this.cartRepository.updateCartItemQuantity(itemId, quantity);
        });
    }
    removeFromCart(itemId, userId, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.assertCartItemOwnership(itemId, userId, sessionId);
            return this.cartRepository.removeCartItem(itemId);
        });
    }
    mergeCartsOnLogin(sessionId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!userId) {
                return;
            }
            const sessionCart = yield this.cartRepository.getCartBySessionId(sessionId);
            if (!sessionCart) {
                return;
            }
            const userCart = yield this.getOrCreateCart(userId);
            if (sessionCart.id === userCart.id) {
                return;
            }
            yield this.cartRepository.mergeCarts(sessionCart.id, userCart.id);
        });
    }
}
exports.CartService = CartService;
