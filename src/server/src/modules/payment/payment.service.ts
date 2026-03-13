import AppError from "@/shared/errors/AppError";
import { PaymentRepository } from "./payment.repository";
import { makeLogsService } from "@/modules/logs/logs.factory";

interface AdminPaymentRequest {
  orderId: string;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';
  amount: number;
  paymentReceivedAt: Date;
  notes?: string;
  // Bank transfer fields
  utrNumber?: string;
  bankName?: string;
  transferDate?: Date;
  // Cheque fields
  chequeNumber?: string;
  chequeDate?: Date;
  chequeClearingDate?: Date;
}

export class PaymentService {
  private logsService = makeLogsService();

  constructor(private paymentRepository: PaymentRepository) {}

  async getUserPayments(userId: string) {
    const payments = await this.paymentRepository.findPaymentsByUserId(userId);
    if (!payments || payments.length === 0) {
      throw new AppError(404, "No payments found for this user");
    }
    return payments;
  }

  async getPaymentDetails(paymentId: string, userId: string) {
    const payment = await this.paymentRepository.findPaymentById(paymentId);
    if (!payment) {
      throw new AppError(404, "Payment not found");
    }
    if (payment.userId !== userId) {
      throw new AppError(403, "You are not authorized to view this payment");
    }
    return payment;
  }

  async deletePayment(paymentId: string) {
    const payment = await this.paymentRepository.findPaymentById(paymentId);
    if (!payment) {
      throw new AppError(404, "Payment not found");
    }
    return this.paymentRepository.deletePayment(paymentId);
  }

  /**
   * Admin records offline payment for pay-later orders
   */
  async recordAdminPayment(request: AdminPaymentRequest, adminUserId: string): Promise<any> {
    // Validate request
    await this.validateAdminPaymentRequest(request);

    // Get order details
    const order = await this.paymentRepository.findOrderById(request.orderId);
    if (!order) {
      throw new AppError(404, "Order not found");
    }

    // Check if order is already paid
    const existingPayment = await this.paymentRepository.findPaymentByOrderId(request.orderId);
    if (existingPayment && existingPayment.status === 'PAID') {
      throw new AppError(409, "Order is already paid");
    }

    // Validate amount
    if (Math.abs(request.amount - order.amount) > 0.01) {
      throw new AppError(400, "Payment amount does not match order total");
    }

    // Create or update payment record
    const paymentData = {
      orderId: request.orderId,
      userId: order.userId,
      method: request.paymentMethod,
      amount: request.amount,
      status: 'PAID' as const,
      metadata: {
        recordedBy: adminUserId,
        paymentReceivedAt: request.paymentReceivedAt,
        notes: request.notes,
        ...(request.utrNumber && { utrNumber: request.utrNumber }),
        ...(request.bankName && { bankName: request.bankName }),
        ...(request.transferDate && { transferDate: request.transferDate }),
        ...(request.chequeNumber && { chequeNumber: request.chequeNumber }),
        ...(request.chequeDate && { chequeDate: request.chequeDate }),
        ...(request.chequeClearingDate && { chequeClearingDate: request.chequeClearingDate }),
      }
    };

    let payment;
    if (existingPayment) {
      payment = await this.paymentRepository.updatePayment(existingPayment.id, paymentData);
    } else {
      payment = await this.paymentRepository.createPayment(paymentData);
    }

    // Update order status to PAID
    await this.paymentRepository.updateOrderStatus(request.orderId, 'PAID');

    // Log the action
    await this.logsService.info('Admin payment recorded', {
      orderId: request.orderId,
      paymentId: payment.id,
      paymentMethod: request.paymentMethod,
      amount: request.amount,
      recordedBy: adminUserId,
    });

    return {
      payment,
      message: 'Payment recorded successfully'
    };
  }

  /**
   * Get outstanding payment orders for admin dashboard
   */
  async getOutstandingPaymentOrders(filters?: {
    dealerId?: string;
    isOverdue?: boolean;
    limit?: number;
    offset?: number;
  }) {
    return this.paymentRepository.findOutstandingOrders(filters);
  }

  /**
   * Validate admin payment request
   */
  private async validateAdminPaymentRequest(request: AdminPaymentRequest): Promise<void> {
    const errors: string[] = [];

    if (!request.orderId) errors.push('Order ID is required');
    if (!request.paymentMethod) errors.push('Payment method is required');
    if (!request.amount || request.amount <= 0) errors.push('Valid payment amount is required');
    if (!request.paymentReceivedAt) errors.push('Payment received date is required');

    // Validate payment method specific fields
    if (request.paymentMethod === 'BANK_TRANSFER') {
      if (!request.utrNumber) errors.push('UTR number is required for bank transfers');
      if (!request.bankName) errors.push('Bank name is required for bank transfers');
      if (!request.transferDate) errors.push('Transfer date is required for bank transfers');
    }

    if (request.paymentMethod === 'CHEQUE') {
      if (!request.chequeNumber) errors.push('Cheque number is required for cheque payments');
      if (!request.bankName) errors.push('Bank name is required for cheque payments');
      if (!request.chequeDate) errors.push('Cheque date is required for cheque payments');
    }

    if (errors.length > 0) {
      throw new AppError(400, errors.join('; '));
    }
  }
}