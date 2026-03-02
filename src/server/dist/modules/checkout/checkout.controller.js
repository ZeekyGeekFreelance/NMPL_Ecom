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
exports.CheckoutController = void 0;
const asyncHandler_1 = __importDefault(require("@/shared/utils/asyncHandler"));
const sendResponse_1 = __importDefault(require("@/shared/utils/sendResponse"));
const AppError_1 = __importDefault(require("@/shared/errors/AppError"));
const logs_factory_1 = require("../logs/logs.factory");
const accountReference_1 = require("@/shared/utils/accountReference");
class CheckoutController {
    constructor(checkoutService, cartService) {
        this.checkoutService = checkoutService;
        this.cartService = cartService;
        this.logsService = (0, logs_factory_1.makeLogsService)();
        this.getCheckoutSummary = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            const userRole = (_b = req.user) === null || _b === void 0 ? void 0 : _b.role;
            if (!userId) {
                throw new AppError_1.default(400, "User not found");
            }
            if (userRole !== "USER") {
                throw new AppError_1.default(403, "Only customer accounts can checkout");
            }
            const summary = yield this.checkoutService.getCheckoutSummary(userId, {
                addressId: (_c = req.body) === null || _c === void 0 ? void 0 : _c.addressId,
                deliveryMode: (_d = req.body) === null || _d === void 0 ? void 0 : _d.deliveryMode,
            });
            (0, sendResponse_1.default)(res, 200, {
                data: summary,
                message: "Checkout summary calculated successfully",
            });
        }));
        this.initiateCheckout = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            const userRole = (_b = req.user) === null || _b === void 0 ? void 0 : _b.role;
            if (!userId) {
                throw new AppError_1.default(400, "User not found");
            }
            if (userRole !== "USER") {
                throw new AppError_1.default(403, "Only customer accounts can place orders");
            }
            const cart = yield this.cartService.getOrCreateCart(userId);
            if (!cart.cartItems || cart.cartItems.length === 0) {
                throw new AppError_1.default(400, "Cart is empty");
            }
            yield this.cartService.logCartEvent(cart.id, "CHECKOUT_STARTED", userId);
            const order = yield this.checkoutService.placeOrder(userId, cart.id, {
                addressId: (_c = req.body) === null || _c === void 0 ? void 0 : _c.addressId,
                deliveryMode: (_d = req.body) === null || _d === void 0 ? void 0 : _d.deliveryMode,
            });
            yield this.cartService.logCartEvent(cart.id, "CHECKOUT_COMPLETED", userId);
            (0, sendResponse_1.default)(res, 201, {
                data: {
                    orderId: order.id,
                    orderReference: (0, accountReference_1.toOrderReference)(order.id),
                    status: order.status,
                    subtotalAmount: order.subtotalAmount,
                    deliveryCharge: order.deliveryCharge,
                    deliveryMode: order.deliveryMode,
                    finalTotal: order.amount,
                    nextStep: "Stock will be verified. You will receive a quotation. Complete payment after approval to confirm your order.",
                },
                message: "Stock will be verified. You will receive a quotation. Complete payment after approval to confirm your order.",
            });
            this.logsService.info("Order placed from checkout", {
                userId,
                orderId: order.id,
                timePeriod: 0,
            });
        }));
    }
}
exports.CheckoutController = CheckoutController;
