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
exports.CartRepository = void 0;
const client_1 = require("@prisma/client");
const database_config_1 = __importDefault(require("@/infra/database/database.config"));
const config_1 = require("@/config");
const isDevelopment = config_1.config.isDevelopment;
const debugLog = (...args) => {
    if (isDevelopment) {
        console.log(...args);
    }
};
class CartRepository {
    getCartByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            debugLog("🔍 [CART REPOSITORY] getCartByUserId called");
            debugLog("🔍 [CART REPOSITORY] userId:", userId);
            const cart = yield database_config_1.default.cart.findFirst({
                where: { userId, status: client_1.CART_STATUS.ACTIVE },
                orderBy: { updatedAt: "desc" },
                include: {
                    cartItems: { include: { variant: { include: { product: true } } } },
                },
            });
            debugLog("🔍 [CART REPOSITORY] Cart found by userId:", cart);
            debugLog("🔍 [CART REPOSITORY] Cart ID:", cart === null || cart === void 0 ? void 0 : cart.id);
            debugLog("🔍 [CART REPOSITORY] Cart items count:", (_a = cart === null || cart === void 0 ? void 0 : cart.cartItems) === null || _a === void 0 ? void 0 : _a.length);
            return cart;
        });
    }
    getCartBySessionId(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            debugLog("🔍 [CART REPOSITORY] getCartBySessionId called");
            debugLog("🔍 [CART REPOSITORY] sessionId:", sessionId);
            const cart = yield database_config_1.default.cart.findFirst({
                where: { sessionId, status: client_1.CART_STATUS.ACTIVE },
                orderBy: { updatedAt: "desc" },
                include: {
                    cartItems: { include: { variant: { include: { product: true } } } },
                },
            });
            debugLog("🔍 [CART REPOSITORY] Cart found by sessionId:", cart);
            debugLog("🔍 [CART REPOSITORY] Cart ID:", cart === null || cart === void 0 ? void 0 : cart.id);
            debugLog("🔍 [CART REPOSITORY] Cart items count:", (_a = cart === null || cart === void 0 ? void 0 : cart.cartItems) === null || _a === void 0 ? void 0 : _a.length);
            return cart;
        });
    }
    createCart(data) {
        return __awaiter(this, void 0, void 0, function* () {
            debugLog("🔍 [CART REPOSITORY] createCart called");
            debugLog("🔍 [CART REPOSITORY] data:", data);
            const cart = yield database_config_1.default.cart.create({
                data,
                include: {
                    cartItems: { include: { variant: { include: { product: true } } } },
                },
            });
            debugLog("🔍 [CART REPOSITORY] Cart created:", cart);
            debugLog("🔍 [CART REPOSITORY] Cart ID:", cart.id);
            return cart;
        });
    }
    findCartItem(cartId, variantId) {
        return __awaiter(this, void 0, void 0, function* () {
            debugLog("🔍 [CART REPOSITORY] findCartItem called");
            debugLog("🔍 [CART REPOSITORY] cartId:", cartId);
            debugLog("🔍 [CART REPOSITORY] variantId:", variantId);
            const item = yield database_config_1.default.cartItem.findFirst({
                where: { cartId, variantId },
            });
            debugLog("🔍 [CART REPOSITORY] Cart item found:", item);
            return item;
        });
    }
    findCartItemById(itemId) {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.cartItem.findUnique({
                where: { id: itemId },
                include: {
                    cart: {
                        select: {
                            id: true,
                            userId: true,
                            sessionId: true,
                        },
                    },
                },
            });
        });
    }
    addItemToCart(data) {
        return __awaiter(this, void 0, void 0, function* () {
            debugLog("🔍 [CART REPOSITORY] addItemToCart called");
            debugLog("🔍 [CART REPOSITORY] data:", data);
            try {
                // Validate stock
                const variant = yield database_config_1.default.productVariant.findUnique({
                    where: { id: data.variantId },
                    select: { stock: true, reservedStock: true },
                });
                debugLog("🔍 [CART REPOSITORY] Variant found for stock check:", variant);
                if (!variant) {
                    debugLog("🔍 [CART REPOSITORY] ERROR: Variant not found");
                    throw new Error("Variant not found");
                }
                const availableStock = variant.stock - (variant.reservedStock || 0);
                if (availableStock < data.quantity) {
                    debugLog("🔍 [CART REPOSITORY] ERROR: Insufficient stock");
                    throw new Error(`Insufficient stock: only ${Math.max(availableStock, 0)} available`);
                }
                const item = yield database_config_1.default.cartItem.create({ data });
                debugLog("🔍 [CART REPOSITORY] Cart item created:", item);
                return item;
            }
            catch (error) {
                debugLog("🔍 [CART REPOSITORY] Error in addItemToCart:", error);
                if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                    error.code === "P2002") {
                    debugLog("🔍 [CART REPOSITORY] ERROR: Item already exists in cart");
                    throw new Error("Item already exists in cart");
                }
                throw error;
            }
        });
    }
    updateCartItemQuantity(itemId, quantity) {
        return __awaiter(this, void 0, void 0, function* () {
            debugLog("🔍 [CART REPOSITORY] updateCartItemQuantity called");
            debugLog("🔍 [CART REPOSITORY] itemId:", itemId);
            debugLog("🔍 [CART REPOSITORY] quantity:", quantity);
            // Validate stock
            const cartItem = yield database_config_1.default.cartItem.findUnique({
                where: { id: itemId },
                include: { variant: true },
            });
            debugLog("🔍 [CART REPOSITORY] Cart item found for update:", cartItem);
            if (!cartItem) {
                debugLog("🔍 [CART REPOSITORY] ERROR: Cart item not found");
                throw new Error("Cart item not found");
            }
            const availableStock = cartItem.variant.stock - (cartItem.variant.reservedStock || 0);
            if (availableStock < quantity) {
                debugLog("🔍 [CART REPOSITORY] ERROR: Insufficient stock for update");
                throw new Error(`Insufficient stock: only ${Math.max(availableStock, 0)} available`);
            }
            const updatedItem = yield database_config_1.default.cartItem.update({
                where: { id: itemId },
                data: { quantity },
            });
            debugLog("🔍 [CART REPOSITORY] Cart item updated:", updatedItem);
            return updatedItem;
        });
    }
    removeCartItem(itemId) {
        return __awaiter(this, void 0, void 0, function* () {
            debugLog("🔍 [CART REPOSITORY] removeCartItem called");
            debugLog("🔍 [CART REPOSITORY] itemId:", itemId);
            const result = yield database_config_1.default.cartItem.delete({ where: { id: itemId } });
            debugLog("🔍 [CART REPOSITORY] Cart item removed:", result);
            return result;
        });
    }
    mergeCarts(sessionCartId, userCartId) {
        return __awaiter(this, void 0, void 0, function* () {
            debugLog("🔍 [CART REPOSITORY] mergeCarts called");
            debugLog("🔍 [CART REPOSITORY] sessionCartId:", sessionCartId);
            debugLog("🔍 [CART REPOSITORY] userCartId:", userCartId);
            const sessionItems = yield database_config_1.default.cartItem.findMany({
                where: { cartId: sessionCartId },
                include: { variant: true },
            });
            debugLog("🔍 [CART REPOSITORY] Session items found:", sessionItems);
            for (const item of sessionItems) {
                const existingItem = yield database_config_1.default.cartItem.findFirst({
                    where: { cartId: userCartId, variantId: item.variantId },
                });
                debugLog("🔍 [CART REPOSITORY] Existing item in user cart:", existingItem);
                if (existingItem) {
                    const newQuantity = existingItem.quantity + item.quantity;
                    debugLog("🔍 [CART REPOSITORY] Merging quantities:", newQuantity);
                    const availableStock = item.variant.stock - (item.variant.reservedStock || 0);
                    if (availableStock < newQuantity) {
                        debugLog("🔍 [CART REPOSITORY] ERROR: Insufficient stock after merge");
                        throw new Error(`Insufficient stock for variant ${item.variantId}: only ${Math.max(availableStock, 0)} available`);
                    }
                    yield database_config_1.default.cartItem.update({
                        where: { id: existingItem.id },
                        data: { quantity: newQuantity },
                    });
                    debugLog("🔍 [CART REPOSITORY] Item quantity updated in user cart");
                }
                else {
                    debugLog("🔍 [CART REPOSITORY] Adding new item to user cart");
                    const availableStock = item.variant.stock - (item.variant.reservedStock || 0);
                    if (availableStock < item.quantity) {
                        debugLog("🔍 [CART REPOSITORY] ERROR: Insufficient stock for new item");
                        throw new Error(`Insufficient stock for variant ${item.variantId}: only ${Math.max(availableStock, 0)} available`);
                    }
                    yield database_config_1.default.cartItem.create({
                        data: {
                            cartId: userCartId,
                            variantId: item.variantId,
                            quantity: item.quantity,
                        },
                    });
                    debugLog("🔍 [CART REPOSITORY] New item added to user cart");
                }
            }
            yield database_config_1.default.cart.delete({ where: { id: sessionCartId } });
            debugLog("🔍 [CART REPOSITORY] Session cart deleted");
        });
    }
    deleteCart(id) {
        return __awaiter(this, void 0, void 0, function* () {
            debugLog("🔍 [CART REPOSITORY] deleteCart called");
            debugLog("🔍 [CART REPOSITORY] cartId:", id);
            const result = yield database_config_1.default.cart.delete({ where: { id } });
            debugLog("🔍 [CART REPOSITORY] Cart deleted:", result);
            return result;
        });
    }
    clearCart(userId, tx) {
        return __awaiter(this, void 0, void 0, function* () {
            debugLog("[CART REPOSITORY] clearCart called");
            debugLog("[CART REPOSITORY] userId:", userId);
            const client = tx || database_config_1.default;
            const activeCarts = yield client.cart.findMany({
                where: { userId, status: client_1.CART_STATUS.ACTIVE },
                select: { id: true },
            });
            const activeCartIds = activeCarts.map((cart) => cart.id);
            debugLog("[CART REPOSITORY] Active cart IDs to clear:", activeCartIds);
            if (!activeCartIds.length) {
                debugLog("[CART REPOSITORY] No active cart found to clear");
                return;
            }
            const result = yield client.cartItem.deleteMany({
                where: { cartId: { in: activeCartIds } },
            });
            debugLog("[CART REPOSITORY] Active cart items cleared:", result);
            return result;
        });
    }
}
exports.CartRepository = CartRepository;
