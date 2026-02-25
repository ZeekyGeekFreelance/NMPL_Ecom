"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const protect_1 = __importDefault(require("@/shared/middlewares/protect"));
const checkout_factory_1 = require("./checkout.factory");
const router = express_1.default.Router();
const checkoutController = (0, checkout_factory_1.makeCheckoutController)();
/**
 * @swagger
 * /checkout:
 *   post:
 *     summary: Place order from cart
 *     description: Validates active cart stock and places an order without payment gateway dependency.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Order placed successfully.
 *       400:
 *         description: Invalid cart state (empty/stock/cart ownership issue).
 *       401:
 *         description: Unauthorized. Token is invalid or missing.
 *       403:
 *         description: Forbidden. Only customer (`USER`) accounts can place orders.
 */
router.post("/", protect_1.default, checkoutController.initiateCheckout);
exports.default = router;
