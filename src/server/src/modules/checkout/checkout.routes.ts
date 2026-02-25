import express from "express";
import protect from "@/shared/middlewares/protect";
import { makeCheckoutController } from "./checkout.factory";

const router = express.Router();
const checkoutController = makeCheckoutController();

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
router.post("/", protect, checkoutController.initiateCheckout);

export default router;
