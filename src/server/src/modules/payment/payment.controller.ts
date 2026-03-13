import { Request, Response } from "express";
import asyncHandler from "@/shared/utils/asyncHandler";
import sendResponse from "@/shared/utils/sendResponse";
import AppError from "@/shared/errors/AppError";
import { PaymentService } from "./payment.service";
import { ComprehensivePaymentService } from "./comprehensivePayment.service";
import { RazorpayGatewayService } from "./razorpayGateway.service";
import { PaymentNotificationService } from "./paymentNotification.service";
import { makeLogsService } from "../logs/logs.factory";
import { PAYMENT_METHOD_TYPE } from "@prisma/client";

export class PaymentController {
  private logsService = makeLogsService();
  private comprehensivePaymentService = new ComprehensivePaymentService();
  private razorpayGatewayService = new RazorpayGatewayService();
  private paymentNotificationService = new PaymentNotificationService();

  constructor(private paymentService: PaymentService) {}

  getUserPayments = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(400, "User not found");
    }
    const payments = await this.paymentService.getUserPayments(userId);
    sendResponse(res, 200, {
      data: payments,
      message: "Payments retrieved successfully",
    });
  });

  getPaymentDetails = asyncHandler(async (req: Request, res: Response) => {
    const { paymentId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(400, "User not found");
    }
    const payment = await this.paymentService.getPaymentDetails(
      paymentId,
      userId
    );
    sendResponse(res, 200, {
      data: payment,
      message: "Payment retrieved successfully",
    });
  });

  deletePayment = asyncHandler(async (req: Request, res: Response) => {
    const { paymentId } = req.params;
    await this.paymentService.deletePayment(paymentId);
    sendResponse(res, 200, { message: "Payment deleted successfully" });
    const start = Date.now();
    const end = Date.now();

    this.logsService.info("Payment deleted", {
      userId: req.user?.id,
      sessionId: req.session.id,
      timePeriod: end - start,
    });
  });

  /**
   * Admin records offline payment with full audit trail
   */
  recordAdminPayment = asyncHandler(async (req: Request, res: Response) => {
    const adminUserId = req.user?.id;
    const adminRole = req.user?.role;

    if (!adminUserId || (adminRole !== "ADMIN" && adminRole !== "SUPERADMIN")) {
      throw new AppError(403, "Only admins can record payments");
    }

    const {
      orderId,
      paymentMethod,
      amount,
      paymentReceivedAt,
      notes,
      // Bank transfer fields
      utrNumber,
      bankName,
      transferDate,
      // Cheque fields
      chequeNumber,
      chequeDate,
      chequeClearingDate,
    } = req.body;

    // Validate payment method
    if (!Object.values(PAYMENT_METHOD_TYPE).includes(paymentMethod)) {
      throw new AppError(400, "Invalid payment method");
    }

    // Only allow offline payment methods for admin recording
    const offlinePaymentMethods = [
      PAYMENT_METHOD_TYPE.CASH,
      PAYMENT_METHOD_TYPE.BANK_TRANSFER,
      PAYMENT_METHOD_TYPE.CHEQUE,
    ];

    if (!offlinePaymentMethods.includes(paymentMethod)) {
      throw new AppError(400, "Only offline payment methods (CASH, BANK_TRANSFER, CHEQUE) can be recorded by admin");
    }

    const result = await this.comprehensivePaymentService.recordAdminPayment({
      orderId,
      paymentMethod,
      amount: Number(amount),
      paymentReceivedAt: new Date(paymentReceivedAt),
      notes,
      utrNumber,
      bankName,
      transferDate: transferDate ? new Date(transferDate) : undefined,
      chequeNumber,
      chequeDate: chequeDate ? new Date(chequeDate) : undefined,
      chequeClearingDate: chequeClearingDate ? new Date(chequeClearingDate) : undefined,
    }, adminUserId);

    // Send payment confirmation emails
    if (result.paymentTransaction && result.invoice) {
      await this.paymentNotificationService.sendPaymentConfirmation({
        orderId: result.paymentTransaction.orderId,
        paymentTransactionId: result.paymentTransaction.id,
        customerEmail: result.invoice.order.user.email,
        customerName: result.invoice.order.user.name,
        paymentMethod: result.paymentTransaction.paymentMethod,
        amount: result.paymentTransaction.amount,
        invoiceNumber: result.invoice.invoiceNumber,
      });
    }

    sendResponse(res, 201, {
      data: result,
      message: "Payment recorded successfully",
    });
  });

  /**
   * Create payment order for gateway processing (Legacy dealers can pay online)
   */
  createPaymentOrder = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "Authentication required");
    }

    const { orderId, customerEmail, customerName, customerPhone } = req.body;

    if (!orderId || !customerEmail || !customerName) {
      throw new AppError(400, "Missing required fields: orderId, customerEmail, customerName");
    }

    // Get order details to validate amount
    const order = await this.comprehensivePaymentService.getOrderById(orderId);
    if (!order) {
      throw new AppError(404, "Order not found");
    }

    // Check if user owns the order or is admin
    const isAdmin = req.user?.role === "ADMIN" || req.user?.role === "SUPERADMIN";
    if (!isAdmin && order.userId !== userId) {
      throw new AppError(403, "Access denied to this order");
    }

    // Create Razorpay order
    const razorpayOrder = await this.razorpayGatewayService.createOrder({
      orderId,
      amount: order.amount,
      customerEmail,
      customerName,
      customerPhone,
    });

    // Get gateway configuration
    const gatewayConfig = this.razorpayGatewayService.getGatewayConfig();

    sendResponse(res, 201, {
      data: {
        razorpayOrder,
        gatewayConfig,
        orderDetails: {
          orderId: order.id,
          amount: order.amount,
          currency: "INR",
        },
      },
      message: "Payment order created successfully",
    });
  });

  /**
   * Verify payment after successful gateway transaction
   */
  verifyPayment = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "Authentication required");
    }

    const {
      orderId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      paymentMethod,
    } = req.body;

    if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new AppError(400, "Missing required payment verification fields");
    }

    // Verify payment with Razorpay
    const verification = await this.razorpayGatewayService.verifyPayment({
      orderId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (!verification.isValid) {
      throw new AppError(400, "Payment verification failed");
    }

    // Map payment method
    const mappedPaymentMethod = this.mapPaymentMethod(
      paymentMethod || verification.paymentDetails.method
    );

    // Process the verified payment
    const result = await this.comprehensivePaymentService.processGatewayPayment({
      orderId,
      paymentMethod: mappedPaymentMethod,
      amount: verification.paymentDetails.amount,
      gatewayName: "Razorpay",
      gatewayOrderId: razorpayOrderId,
      gatewayPaymentId: razorpayPaymentId,
      gatewaySignature: razorpaySignature,
      gatewayPayload: verification.paymentDetails,
    });

    // Send payment confirmation emails
    if (result.paymentTransaction && result.invoice) {
      await this.paymentNotificationService.sendPaymentConfirmation({
        orderId: result.paymentTransaction.orderId,
        paymentTransactionId: result.paymentTransaction.id,
        customerEmail: result.invoice.order.user.email,
        customerName: result.invoice.order.user.name,
        paymentMethod: result.paymentTransaction.paymentMethod,
        amount: result.paymentTransaction.amount,
        invoiceNumber: result.invoice.invoiceNumber,
        gatewayPaymentId: result.paymentTransaction.gatewayPaymentId,
      });
    }

    sendResponse(res, 200, {
      data: result,
      message: "Payment verified and processed successfully",
    });
  });

  /**
   * Get outstanding payment orders (Admin only)
   */
  getOutstandingPaymentOrders = asyncHandler(async (req: Request, res: Response) => {
    const userRole = req.user?.role;

    if (userRole !== "ADMIN" && userRole !== "SUPERADMIN") {
      throw new AppError(403, "Only admins can view outstanding payment orders");
    }

    const { dealerId, isOverdue, limit, offset } = req.query;

    const filters: any = {};
    if (dealerId) filters.dealerId = dealerId as string;
    if (isOverdue === "true") filters.isOverdue = true;
    if (limit) filters.limit = Number(limit);
    if (offset) filters.offset = Number(offset);

    const outstandingOrders = await this.comprehensivePaymentService.getOutstandingPaymentOrders(filters);

    sendResponse(res, 200, {
      data: { orders: outstandingOrders, totalCount: outstandingOrders.length },
      message: "Outstanding payment orders retrieved successfully",
    });
  });

  /**
   * Get dealer credit ledger (Admin only)
   */
  getDealerCreditLedger = asyncHandler(async (req: Request, res: Response) => {
    const { dealerId } = req.params;
    const userRole = req.user?.role;

    if (userRole !== "ADMIN" && userRole !== "SUPERADMIN") {
      throw new AppError(403, "Only admins can view credit ledgers");
    }

    const ledgerData = await this.comprehensivePaymentService.getDealerCreditLedger(dealerId);

    sendResponse(res, 200, {
      data: ledgerData,
      message: "Dealer credit ledger retrieved successfully",
    });
  });

  /**
   * Get payment audit trail for an order (Admin only)
   */
  getOrderAuditTrail = asyncHandler(async (req: Request, res: Response) => {
    const { orderId } = req.params;
    const userRole = req.user?.role;

    if (userRole !== "ADMIN" && userRole !== "SUPERADMIN") {
      throw new AppError(403, "Only admins can view audit trails");
    }

    const auditTrail = await this.comprehensivePaymentService.getOrderAuditTrail(orderId);

    sendResponse(res, 200, {
      data: { logs: auditTrail, totalCount: auditTrail.length },
      message: "Order audit trail retrieved successfully",
    });
  });

  /**
   * Get gateway configuration for frontend
   */
  getGatewayConfig = asyncHandler(async (req: Request, res: Response) => {
    const config = this.razorpayGatewayService.getGatewayConfig();

    sendResponse(res, 200, {
      data: { config },
      message: "Gateway configuration retrieved successfully",
    });
  });

  /**
   * Map gateway payment method to our enum
   */
  private mapPaymentMethod(gatewayMethod: string): PAYMENT_METHOD_TYPE {
    const methodMap: Record<string, PAYMENT_METHOD_TYPE> = {
      upi: PAYMENT_METHOD_TYPE.UPI,
      netbanking: PAYMENT_METHOD_TYPE.NET_BANKING,
      card: PAYMENT_METHOD_TYPE.CARD,
      wallet: PAYMENT_METHOD_TYPE.WALLET,
    };

    return methodMap[gatewayMethod.toLowerCase()] || PAYMENT_METHOD_TYPE.UPI;
  }
}