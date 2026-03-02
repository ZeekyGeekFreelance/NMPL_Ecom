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
const dealerAccess_1 = require("@/shared/utils/dealerAccess");
const config_1 = require("@/config");
const isDevelopment = config_1.config.isDevelopment;
const debugLog = (...args) => {
    if (isDevelopment) {
        console.log(...args);
    }
};
class CartService {
    constructor(cartRepository) {
        this.cartRepository = cartRepository;
    }
    applyDealerPricingToCart(cart, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!userId || !((_a = cart === null || cart === void 0 ? void 0 : cart.cartItems) === null || _a === void 0 ? void 0 : _a.length)) {
                return cart;
            }
            const variantIds = cart.cartItems.map((item) => item.variantId);
            const dealerPriceMap = yield (0, dealerAccess_1.getDealerPriceMap)(database_config_1.default, userId, variantIds);
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
    getOrCreateCart(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            debugLog("[CART SERVICE] getOrCreateCart called", { userId });
            if (!userId) {
                throw new AppError_1.default(401, "Authentication required for cart access");
            }
            let cart = yield this.cartRepository.getCartByUserId(userId);
            if (!cart) {
                cart = yield this.cartRepository.createCart({ userId });
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
    getCartCount(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const cart = yield this.getOrCreateCart(userId);
            return cart.cartItems.length;
        });
    }
    addToCart(variantId, quantity, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (quantity <= 0) {
                throw new AppError_1.default(400, "Quantity must be greater than 0");
            }
            const cart = yield this.getOrCreateCart(userId);
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
    assertCartItemOwnership(itemId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!userId) {
                throw new AppError_1.default(401, "Authentication required for cart access");
            }
            const cartItem = yield this.cartRepository.findCartItemById(itemId);
            if (!cartItem) {
                throw new AppError_1.default(404, "Cart item not found");
            }
            if (cartItem.cart.userId !== userId) {
                throw new AppError_1.default(403, "You are not authorized to access this cart");
            }
        });
    }
    updateCartItemQuantity(itemId, quantity, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (quantity <= 0) {
                throw new AppError_1.default(400, "Quantity must be greater than 0");
            }
            yield this.assertCartItemOwnership(itemId, userId);
            return this.cartRepository.updateCartItemQuantity(itemId, quantity);
        });
    }
    removeFromCart(itemId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.assertCartItemOwnership(itemId, userId);
            return this.cartRepository.removeCartItem(itemId);
        });
    }
    mergeCartsOnLogin(sessionId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!userId || !sessionId) {
                return;
            }
            // Cart now uses authenticated user ownership as the single source of truth.
            yield this.getOrCreateCart(userId);
        });
    }
    clearCartOnSignOut(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!userId) {
                return;
            }
            yield this.cartRepository.clearCart(userId);
        });
    }
}
exports.CartService = CartService;
