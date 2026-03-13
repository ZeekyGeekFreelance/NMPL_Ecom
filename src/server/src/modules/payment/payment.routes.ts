import express from "express";
import protect from "@/shared/middlewares/protect";
import { makePaymentController } from "./payment.factory";

const router = express.Router();
const paymentController = makePaymentController();

// Admin endpoints (must come before /:paymentId)
/**
 * @swagger
 * /payments/outstanding:
 *   get:
 *     summary: Get outstanding payment orders (Admin only)
 *     description: Retrieves orders with outstanding payments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dealerId
 *         schema:
 *           type: string
 *         description: Filter by specific dealer
 *       - in: query
 *         name: isOverdue
 *         schema:
 *           type: boolean
 *         description: Filter overdue orders only
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of results to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Number of results to skip
 *     responses:
 *       200:
 *         description: Outstanding orders retrieved successfully
 *       403:
 *         description: Admin access required
 */
router.get("/outstanding", protect, paymentController.getOutstandingPaymentOrders);

/**
 * @swagger
 * /payments/record:
 *   post:
 *     summary: Record offline payment (Admin only)
 *     description: Admin records offline payment for pay-later orders with full audit trail
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *               - paymentMethod
 *               - amount
 *               - paymentReceivedAt
 *             properties:
 *               orderId:
 *                 type: string
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, BANK_TRANSFER, CHEQUE]
 *               amount:
 *                 type: number
 *               paymentReceivedAt:
 *                 type: string
 *                 format: date-time
 *               notes:
 *                 type: string
 *               utrNumber:
 *                 type: string
 *               bankName:
 *                 type: string
 *               transferDate:
 *                 type: string
 *                 format: date-time
 *               chequeNumber:
 *                 type: string
 *               chequeDate:
 *                 type: string
 *                 format: date-time
 *               chequeClearingDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Payment recorded successfully with audit trail
 *       400:
 *         description: Invalid request data
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Order not found
 *       409:
 *         description: Order already paid
 */
router.post("/record", protect, paymentController.recordAdminPayment);

/**
 * @swagger
 * /payments/credit-ledger/{dealerId}:
 *   get:
 *     summary: Get dealer credit ledger (Admin only)
 *     description: Retrieves complete credit ledger for a dealer
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dealerId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the dealer
 *     responses:
 *       200:
 *         description: Credit ledger retrieved successfully
 *       403:
 *         description: Admin access required
 */
router.get("/credit-ledger/:dealerId", protect, paymentController.getDealerCreditLedger);

/**
 * @swagger
 * /payments/audit-trail/{orderId}:
 *   get:
 *     summary: Get payment audit trail for an order (Admin only)
 *     description: Retrieves complete audit trail for all payment actions on an order
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the order
 *     responses:
 *       200:
 *         description: Audit trail retrieved successfully
 *       403:
 *         description: Admin access required
 */
router.get("/audit-trail/:orderId", protect, paymentController.getOrderAuditTrail);

// Gateway payment endpoints
/**
 * @swagger
 * /payments/gateway/config:
 *   get:
 *     summary: Get gateway configuration
 *     description: Get Razorpay gateway configuration for frontend
 *     responses:
 *       200:
 *         description: Gateway configuration retrieved successfully
 */
router.get("/gateway/config", paymentController.getGatewayConfig);

/**
 * @swagger
 * /payments/gateway/create-order:
 *   post:
 *     summary: Create payment order for gateway processing
 *     description: Creates Razorpay order for online payment (Legacy dealers can pay online)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *               - customerEmail
 *               - customerName
 *             properties:
 *               orderId:
 *                 type: string
 *               customerEmail:
 *                 type: string
 *               customerName:
 *                 type: string
 *               customerPhone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Payment order created successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied to this order
 *       404:
 *         description: Order not found
 */
router.post("/gateway/create-order", protect, paymentController.createPaymentOrder);

/**
 * @swagger
 * /payments/gateway/verify-payment:
 *   post:
 *     summary: Verify payment after successful gateway transaction
 *     description: Verifies Razorpay payment and processes it with full audit trail
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *               - razorpayOrderId
 *               - razorpayPaymentId
 *               - razorpaySignature
 *             properties:
 *               orderId:
 *                 type: string
 *               razorpayOrderId:
 *                 type: string
 *               razorpayPaymentId:
 *                 type: string
 *               razorpaySignature:
 *                 type: string
 *               paymentMethod:
 *                 type: string
 *                 enum: [UPI, NET_BANKING, CARD, WALLET]
 *     responses:
 *       200:
 *         description: Payment verified and processed successfully
 *       400:
 *         description: Payment verification failed or invalid data
 *       401:
 *         description: Authentication required
 */
router.post("/gateway/verify-payment", protect, paymentController.verifyPayment);

/**
 * @swagger
 * /payments:
 *   get:
 *     summary: Get user's payments
 *     description: Retrieves a list of all payments made by the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of payments.
 */
router.get("/", protect, paymentController.getUserPayments);

/**
 * @swagger
 * /payments/{paymentId}:
 *   get:
 *     summary: Get payment details by ID
 *     description: Retrieves details of a specific payment by its ID.
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the payment to retrieve.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment details.
 *       404:
 *         description: Payment not found.
 */
router.get("/:paymentId", protect, paymentController.getPaymentDetails);

/**
 * @swagger
 * /payments/{paymentId}:
 *   delete:
 *     summary: Delete payment by ID
 *     description: Deletes a specific payment by its ID.
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the payment to delete.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment deleted successfully.
 *       404:
 *         description: Payment not found.
 */
router.delete("/:paymentId", protect, paymentController.deletePayment);

export default router;