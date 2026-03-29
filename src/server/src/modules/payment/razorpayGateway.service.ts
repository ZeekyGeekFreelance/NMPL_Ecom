import crypto from "crypto";
import { config } from "@/config";
import AppError from "@/shared/errors/AppError";
import { makeLogsService } from "@/modules/logs/logs.factory";
import prisma from "@/infra/database/database.config";

interface RazorpayOrderRequest {
  orderId: string;
  amount: number;
  currency?: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
}

interface RazorpayOrderResponse {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
  isMockPayment: boolean;
}

interface PaymentVerificationRequest {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  orderId: string;
}

export class RazorpayGatewayService {
  private logsService = makeLogsService();
  private razorpayKeyId: string;
  private razorpayKeySecret: string;
  private isMockMode: boolean;

  constructor() {
    // Load Razorpay credentials from config (env is parsed centrally)
    // In production, RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET should be set
    // In development/testing, use RAZORPAY_MOCK_KEY_ID and RAZORPAY_MOCK_KEY_SECRET
    const liveKeyId = config.payment.razorpayKeyId?.trim() || "";
    const liveKeySecret = config.payment.razorpayKeySecret?.trim() || "";
    const mockKeyId = config.payment.razorpayMockKeyId?.trim() || "";
    const mockKeySecret = config.payment.razorpayMockKeySecret?.trim() || "";

    // Enable mock mode if credentials are not configured or explicitly set
    this.isMockMode =
      !config.isProduction &&
      (config.payment.razorpayMockMode || !liveKeyId || !liveKeySecret);
    this.razorpayKeyId = this.isMockMode ? (mockKeyId || liveKeyId) : liveKeyId;
    this.razorpayKeySecret = this.isMockMode
      ? (mockKeySecret || liveKeySecret)
      : liveKeySecret;

    if (this.isMockMode) {
      this.logsService.info("Razorpay running in MOCK mode - no real payments will be processed");
    } else {
      this.logsService.info("Razorpay running in LIVE mode", {
        keyId: this.razorpayKeyId.substring(0, 8) + "...", // Log partial key for verification
      });
    }
  }

  /**
   * Create Razorpay order for payment
   */
  async createOrder(request: RazorpayOrderRequest): Promise<RazorpayOrderResponse> {
    if (this.isMockMode) {
      return this.createMockOrder(request);
    }

    try {
      // In production, you would use the actual Razorpay SDK here
      // const Razorpay = require('razorpay');
      // const razorpay = new Razorpay({
      //   key_id: this.razorpayKeyId,
      //   key_secret: this.razorpayKeySecret,
      // });

      // const order = await razorpay.orders.create({
      //   amount: request.amount * 100, // Convert to paise
      //   currency: request.currency || 'INR',
      //   receipt: request.orderId,
      //   notes: {
      //     orderId: request.orderId,
      //     customerEmail: request.customerEmail,
      //     customerName: request.customerName,
      //   },
      // });

      // For now, return mock response until actual Razorpay integration
      return this.createMockOrder(request);

    } catch (error) {
      this.logsService.error("Failed to create Razorpay order", {
        orderId: request.orderId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw new AppError(500, "Failed to create payment order");
    }
  }

  /**
   * Verify payment signature and fetch payment details
   */
  async verifyPayment(request: PaymentVerificationRequest): Promise<any> {
    if (this.isMockMode) {
      return this.verifyMockPayment(request);
    }

    try {
      // Verify signature
      const isSignatureValid = this.verifyRazorpaySignature(
        request.razorpayOrderId,
        request.razorpayPaymentId,
        request.razorpaySignature
      );

      if (!isSignatureValid) {
        throw new AppError(400, "Invalid payment signature");
      }

      // In production, fetch payment details from Razorpay
      // const payment = await razorpay.payments.fetch(request.razorpayPaymentId);

      // For now, return mock verification
      return this.verifyMockPayment(request);

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logsService.error("Failed to verify Razorpay payment", {
        orderId: request.orderId,
        razorpayPaymentId: request.razorpayPaymentId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw new AppError(500, "Failed to verify payment");
    }
  }

  /**
   * Create mock order for development/testing
   */
  private createMockOrder(request: RazorpayOrderRequest): RazorpayOrderResponse {
    // nosemgrep: hardcoded-credential
    // This is NOT a hardcoded credential - it's a dynamically generated mock order ID
    // using timestamp and random values for development/testing purposes only
    const mockOrderId = `order_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.logsService.info("Created mock Razorpay order", {
      orderId: request.orderId,
      mockOrderId,
      amount: request.amount,
    });

    return {
      razorpayOrderId: mockOrderId,
      amount: request.amount,
      currency: request.currency || "INR",
      keyId: this.razorpayKeyId,
      isMockPayment: true,
    };
  }

  /**
   * Verify mock payment for development/testing
   */
  private async verifyMockPayment(request: PaymentVerificationRequest): Promise<any> {
    // nosemgrep: hardcoded-credential
    // This is NOT a hardcoded credential - it's a dynamically generated mock payment ID
    // using timestamp and random values for development/testing purposes only
    const mockPaymentId = `pay_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let amount = 0;

    try {
      const order = await prisma.order.findUnique({
        where: { id: request.orderId },
        select: { amount: true },
      });
      amount = typeof order?.amount === "number" ? order.amount : 0;
    } catch (error) {
      this.logsService.error("Failed to load order amount for mock payment", {
        orderId: request.orderId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    
    this.logsService.info("Verified mock Razorpay payment", {
      orderId: request.orderId,
      mockPaymentId,
      razorpayOrderId: request.razorpayOrderId,
    });

    return {
      isValid: true,
      paymentDetails: {
        paymentId: mockPaymentId,
        orderId: request.razorpayOrderId,
        amount: amount || 0,
        currency: "INR",
        method: "upi", // Mock method
        status: "captured",
        createdAt: new Date(),
      },
    };
  }

  /**
   * Verify Razorpay payment signature
   */
  private verifyRazorpaySignature(
    orderId: string,
    paymentId: string,
    signature: string
  ): boolean {
    if (this.isMockMode) {
      return true; // Mock mode always validates
    }

    const body = orderId + "|" + paymentId;
    const expectedSignature = crypto
      .createHmac("sha256", this.razorpayKeySecret)
      .update(body.toString())
      .digest("hex");

    try {
      const expectedBuffer = Buffer.from(expectedSignature, "hex");
      const providedBuffer = Buffer.from(signature, "hex");

      if (expectedBuffer.length !== providedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Get gateway configuration for frontend
   */
  getGatewayConfig(): {
    keyId: string;
    isMockMode: boolean;
    availableMethods: string[];
  } {
    // nosemgrep: hardcoded-credential
    // This returns environment-loaded credentials and configuration, not hardcoded values
    // keyId is loaded from config in constructor; availableMethods are payment options
    return {
      keyId: this.razorpayKeyId,
      isMockMode: this.isMockMode,
      availableMethods: ["upi", "netbanking", "card", "wallet"],
    };
  }
}
