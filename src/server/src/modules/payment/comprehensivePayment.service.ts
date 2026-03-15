import AppError from "@/shared/errors/AppError";
import { makeLogsService } from "@/modules/logs/logs.factory";
import prisma from "@/infra/database/database.config";
import {
  PAYMENT_METHOD_TYPE,
  PAYMENT_SOURCE_TYPE,
  PAYMENT_TXN_STATUS,
  INVOICE_PAYMENT_STATUS,
} from "@prisma/client";

interface AdminPaymentRequest {
  orderId: string;
  paymentMethod: PAYMENT_METHOD_TYPE;
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

interface GatewayPaymentRequest {
  orderId: string;
  paymentMethod: PAYMENT_METHOD_TYPE;
  amount: number;
  gatewayName: string;
  gatewayOrderId: string;
  gatewayPaymentId: string;
  gatewaySignature?: string;
  gatewayPayload: any;
}

export class ComprehensivePaymentService {
  private logsService = makeLogsService();

  /**
   * Admin records offline payment with full audit trail
   */
  async recordAdminPayment(request: AdminPaymentRequest, adminUserId: string): Promise<any> {
    return await prisma.$transaction(async (tx: any) => {
      // 1. Validate request
      await this.validateAdminPaymentRequest(request, tx);

      // 2. Get order details
      const order = await tx.order.findUnique({
        where: { id: request.orderId },
        include: { 
          user: true, 
          invoice: { where: { isLatest: true } },
          paymentTransactions: { where: { status: 'CONFIRMED' } }
        }
      });

      if (!order) {
        throw new AppError(404, "Order not found");
      }

      // invoice is an array from the include â€” pick the first (latest) entry
      const latestInvoice = Array.isArray(order.invoice) ? order.invoice[0] ?? null : (order.invoice ?? null);

      // 3. Check for existing confirmed payment
      if (order.paymentTransactions.length > 0) {
        throw new AppError(409, "Order is already paid");
      }

      // 4. Create PaymentTransaction record
      const paymentTransaction = await tx.paymentTransaction.create({
        data: {
          orderId: request.orderId,
          userId: order.userId,
          recordedByUserId: adminUserId,
          amount: request.amount,
          paymentMethod: request.paymentMethod,
          paymentSource: PAYMENT_SOURCE_TYPE.ADMIN_MANUAL,
          paymentReceivedAt: request.paymentReceivedAt,
          notes: request.notes,
          utrNumber: request.utrNumber,
          bankName: request.bankName,
          transferDate: request.transferDate,
          chequeNumber: request.chequeNumber,
          chequeDate: request.chequeDate,
          chequeClearingDate: request.chequeClearingDate,
          status: PAYMENT_TXN_STATUS.CONFIRMED,
          invoiceId: latestInvoice?.id ?? null,
        }
      });

      // 5. Update order status
      await tx.order.update({
        where: { id: request.orderId },
        data: { status: order.status === "DELIVERED" ? "DELIVERED" : "PAID" }
      });

      // 6. Update legacy payment record for backward compatibility
      await this.updateLegacyPaymentRecord(request.orderId, {
        method: request.paymentMethod,
        amount: request.amount,
        status: 'PAID'
      }, tx);

      // 7. Create audit log
      await tx.paymentAuditLog.create({
        data: {
          orderId: request.orderId,
          paymentTxnId: paymentTransaction.id,
          invoiceId: latestInvoice?.id ?? null,
          actorUserId: adminUserId,
          actorRole: 'ADMIN',
          action: `ADMIN_MARKED_${request.paymentMethod}`,
          previousStatus: 'PENDING',
          nextStatus: 'PAID',
          metadata: {
            paymentMethod: request.paymentMethod,
            amount: request.amount,
            ...(request.utrNumber && { utrNumber: request.utrNumber }),
            ...(request.chequeNumber && { chequeNumber: request.chequeNumber }),
            ...(request.bankName && { bankName: request.bankName }),
          }
        }
      });

      // 8. Update dealer credit ledger if pay-later order
      if (order.isPayLater) {
        await this.updateDealerCreditLedger(order.userId, request.orderId, paymentTransaction.id, request.amount, tx);
      }

      // 9. Regenerate invoice with payment details
      const updatedInvoice = await this.regenerateInvoiceAfterPayment(request.orderId, paymentTransaction.id, tx);

      // 10. Log success
      await this.logsService.info('Admin payment recorded successfully', {
        orderId: request.orderId,
        paymentTransactionId: paymentTransaction.id,
        paymentMethod: request.paymentMethod,
        amount: request.amount,
        recordedBy: adminUserId,
      });

      return {
        paymentTransaction,
        invoice: updatedInvoice,
        message: 'Payment recorded successfully'
      };
    });
  }

  /**
   * Process online gateway payment for legacy dealers
   */
  async processGatewayPayment(request: GatewayPaymentRequest): Promise<any> {
    return await prisma.$transaction(async (tx) => {
      // 1. Check for duplicate gateway payment ID
      const existingPayment = await tx.paymentTransaction.findUnique({
        where: { gatewayPaymentId: request.gatewayPaymentId }
      });
      
      if (existingPayment) {
        throw new AppError(409, "Payment already processed - duplicate gateway payment ID");
      }

      // 2. Get order details
      const order = await tx.order.findUnique({
        where: { id: request.orderId },
        include: { 
          user: true, 
          invoice: { where: { isLatest: true } },
          paymentTransactions: { where: { status: 'CONFIRMED' } }
        }
      });

      if (!order) {
        throw new AppError(404, "Order not found");
      }

      // invoice is an array from the include â€” pick the first (latest) entry
      const latestInvoice = Array.isArray(order.invoice) ? order.invoice[0] ?? null : (order.invoice ?? null);

      // 3. Validate amount
      if (Math.abs(request.amount - order.amount) > 0.01) {
        throw new AppError(400, "Payment amount does not match order total");
      }

      // 4. Check if already paid
      if (order.paymentTransactions.length > 0) {
        throw new AppError(409, "Order is already paid");
      }

      // 5. Create PaymentTransaction record
      const paymentTransaction = await tx.paymentTransaction.create({
        data: {
          orderId: request.orderId,
          userId: order.userId,
          amount: request.amount,
          paymentMethod: request.paymentMethod,
          paymentSource: request.gatewayName === "MOCK_GATEWAY" 
            ? PAYMENT_SOURCE_TYPE.MOCK_GATEWAY 
            : PAYMENT_SOURCE_TYPE.GATEWAY,
          gatewayName: request.gatewayName,
          gatewayOrderId: request.gatewayOrderId,
          gatewayPaymentId: request.gatewayPaymentId,
          gatewaySignature: request.gatewaySignature,
          gatewayPayload: request.gatewayPayload,
          paymentReceivedAt: new Date(),
          status: PAYMENT_TXN_STATUS.CONFIRMED,
          invoiceId: latestInvoice?.id ?? null,
        }
      });

      // 6. Update order status
      await tx.order.update({
        where: { id: request.orderId },
        data: { status: order.status === "DELIVERED" ? "DELIVERED" : "PAID" }
      });

      // 7. Update legacy payment record
      await this.updateLegacyPaymentRecord(request.orderId, {
        method: request.paymentMethod,
        amount: request.amount,
        status: 'PAID'
      }, tx);

      // 8. Create audit log
      await tx.paymentAuditLog.create({
        data: {
          orderId: request.orderId,
          paymentTxnId: paymentTransaction.id,
          invoiceId: latestInvoice?.id ?? null,
          actorUserId: order.userId,
          actorRole: order.customerRoleSnapshot || 'USER',
          action: 'GATEWAY_PAYMENT_CONFIRMED',
          previousStatus: 'PENDING',
          nextStatus: 'PAID',
          metadata: {
            gatewayName: request.gatewayName,
            gatewayPaymentId: request.gatewayPaymentId,
            paymentMethod: request.paymentMethod,
            amount: request.amount,
          }
        }
      });

      // 9. Update dealer credit ledger if pay-later order
      if (order.isPayLater) {
        await this.updateDealerCreditLedger(order.userId, request.orderId, paymentTransaction.id, request.amount, tx);
      }

      // 10. Regenerate invoice with payment details
      const updatedInvoice = await this.regenerateInvoiceAfterPayment(request.orderId, paymentTransaction.id, tx);

      return {
        paymentTransaction,
        invoice: updatedInvoice,
        message: 'Gateway payment processed successfully'
      };
    });
  }

  /**
   * Regenerate invoice after payment with updated payment details
   */
  private async regenerateInvoiceAfterPayment(orderId: string, paymentTransactionId: string, tx: any): Promise<any> {
    // 1. Load order + latest invoice
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { user: true }
    });
    if (!order) {
      throw new AppError(404, "Order not found");
    }

    const latestInvoice = await tx.invoice.findFirst({
      where: { orderId, isLatest: true },
      orderBy: { version: "desc" },
    });
    const paymentTransaction = await tx.paymentTransaction.findUnique({
      where: { id: paymentTransactionId },
      select: { id: true, userId: true, recordedByUserId: true },
    });
    if (!paymentTransaction) {
      throw new AppError(404, "Payment transaction not found");
    }
    const auditActorUserId =
      paymentTransaction.recordedByUserId || paymentTransaction.userId;

    const invoiceInclude = {
      paymentTransactions: true,
      order: {
        include: {
          user: true,
          orderItems: {
            include: {
              variant: {
                include: { product: true }
              }
            }
          }
        }
      }
    };

    if (latestInvoice) {
      const updatedInvoice = await tx.invoice.update({
        where: { id: latestInvoice.id },
        data: {
          paymentStatus: INVOICE_PAYMENT_STATUS.PAID,
          isLatest: true,
          paymentTransactions: {
            connect: { id: paymentTransactionId },
          },
        },
        include: invoiceInclude,
      });

      await tx.paymentAuditLog.create({
        data: {
          orderId,
          invoiceId: updatedInvoice.id,
          paymentTxnId: paymentTransactionId,
          actorUserId: auditActorUserId,
          actorRole: 'SYSTEM',
          action: 'INVOICE_UPDATED',
          metadata: {
            invoiceId: updatedInvoice.id,
            invoiceVersion: updatedInvoice.version,
          }
        }
      });

      return updatedInvoice;
    }

    const year = new Date().getFullYear();
    const counter = await tx.invoiceCounter.upsert({
      where: { year },
      update: { sequence: { increment: 1 } },
      create: { year, sequence: 1 }
    });
    const invoiceNumber = `INV-${year}-${String(counter.sequence).padStart(6, '0')}`;

    const newInvoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        orderId,
        userId: order.userId,
        customerEmail: order.user.email,
        paymentStatus: INVOICE_PAYMENT_STATUS.PAID,
        version: 1,
        isLatest: true,
        paymentTransactions: {
          connect: { id: paymentTransactionId }
        }
      },
      include: invoiceInclude,
    });

    await tx.paymentAuditLog.create({
      data: {
        orderId,
        invoiceId: newInvoice.id,
        paymentTxnId: paymentTransactionId,
        actorUserId: auditActorUserId,
        actorRole: 'SYSTEM',
        action: 'INVOICE_CREATED',
        metadata: {
          invoiceId: newInvoice.id,
          invoiceVersion: newInvoice.version,
        }
      }
    });

    return newInvoice;
  }

  /**
   * Update dealer credit ledger for pay-later orders
   */
  private async updateDealerCreditLedger(dealerId: string, orderId: string, paymentTxnId: string, amount: number, tx: any): Promise<void> {
    // Get current balance
    const latestEntry = await tx.dealerCreditLedger.findFirst({
      where: { dealerId },
      orderBy: { createdAt: 'desc' }
    });
    const currentBalance = latestEntry?.balanceAfter || 0;
    const newBalance = Math.max(0, currentBalance - amount);

    // Create credit entry
    await tx.dealerCreditLedger.create({
      data: {
        dealerId,
        orderId,
        paymentTxnId,
        eventType: 'PAYMENT_RECEIVED',
        debitAmount: 0,
        creditAmount: amount,
        balanceAfter: newBalance,
        notes: `Payment received - amount paid: â‚¹${amount}`
      }
    });
  }

  /**
   * Update legacy payment record for backward compatibility
   */
  private async updateLegacyPaymentRecord(orderId: string, data: { method: string; amount: number; status: string }, tx: any): Promise<void> {
    const existingPayment = await tx.payment.findFirst({
      where: { orderId }
    });

    if (existingPayment) {
      await tx.payment.update({
        where: { id: existingPayment.id },
        data: {
          method: data.method,
          amount: data.amount,
          status: data.status as any
        }
      });
    } else {
      const order = await tx.order.findUnique({
        where: { id: orderId }
      });
      
      if (order) {
        await tx.payment.create({
          data: {
            orderId,
            userId: order.userId,
            method: data.method,
            amount: data.amount,
            status: data.status as any
          }
        });
      }
    }
  }

  /**
   * Validate admin payment request
   */
  private async validateAdminPaymentRequest(request: AdminPaymentRequest, tx: any): Promise<void> {
    const errors: string[] = [];

    // Basic validation
    if (!request.orderId) errors.push('Order ID is required');
    if (!request.paymentMethod) errors.push('Payment method is required');
    if (!request.amount || request.amount <= 0) errors.push('Valid payment amount is required');
    if (!request.paymentReceivedAt) errors.push('Payment received date is required');

    // Payment method specific validation
    if (request.paymentMethod === PAYMENT_METHOD_TYPE.BANK_TRANSFER) {
      if (!request.utrNumber) errors.push('UTR number is required for bank transfers');
      if (!request.bankName) errors.push('Bank name is required for bank transfers');
      if (!request.transferDate) errors.push('Transfer date is required for bank transfers');
    }

    if (request.paymentMethod === PAYMENT_METHOD_TYPE.CHEQUE) {
      if (!request.chequeNumber) errors.push('Cheque number is required for cheque payments');
      if (!request.bankName) errors.push('Bank name is required for cheque payments');
      if (!request.chequeDate) errors.push('Cheque date is required for cheque payments');
    }

    // Check for duplicate UTR or cheque number
    if (request.utrNumber) {
      const duplicateUtr = await tx.paymentTransaction.findFirst({
        where: { utrNumber: request.utrNumber }
      });
      if (duplicateUtr) {
        errors.push('UTR number already exists in system');
      }
    }

    if (request.chequeNumber && request.bankName) {
      const duplicateCheque = await tx.paymentTransaction.findFirst({
        where: {
          chequeNumber: request.chequeNumber,
          bankName: request.bankName
        }
      });
      if (duplicateCheque) {
        errors.push('Cheque number already exists for this bank');
      }
    }

    if (errors.length > 0) {
      throw new AppError(400, errors.join('; '));
    }
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
    // Outstanding = pay-later orders that have been DELIVERED (payment now owed)
    // or CONFIRMED (stock released, awaiting delivery) and are not yet paid.
    // Explicitly exclude PENDING_VERIFICATION / WAITLISTED / AWAITING_PAYMENT
    // orders — those are not yet "outstanding" from a collections standpoint.
    const where: any = {
      isPayLater: true,
      status: { in: ['DELIVERED', 'CONFIRMED'] },
      paymentTransactions: {
        none: { status: 'CONFIRMED' }
      },
    };

    if (filters?.dealerId) {
      where.userId = filters.dealerId;
    }

    if (filters?.isOverdue) {
      where.paymentDueDate = {
        lt: new Date()
      };
    }

    return await prisma.order.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            dealerProfile: {
              select: {
                businessName: true,
                status: true,
                creditTermDays: true
              }
            }
          }
        },
        orderItems: {
          include: {
            variant: {
              include: { product: true }
            }
          }
        },
        invoice: {
          where: { isLatest: true },
          select: {
            id: true,
            invoiceNumber: true,
            version: true,
            paymentStatus: true,
            paymentDueDate: true,
            isLatest: true,
          },
        },
        transaction: {
          select: {
            id: true,
            status: true,
            transactionDate: true,
          },
        },
        paymentTransactions: true
      },
      orderBy: {
        paymentDueDate: 'asc'
      },
      take: filters?.limit || 50,
      skip: filters?.offset || 0
    });
  }

  /**
   * Get dealer credit ledger entries, enriched with full PaymentTransaction details.
   *
   * DealerCreditLedger.paymentTxnId is a bare string field (no Prisma relation),
   * so we batch-fetch the linked PaymentTransaction rows and stitch them in.
   * This connects PAY-XXXXXXXX in the UI to real payment data: method, gateway ID
   * (Razorpay pay_mock_...), UTR/cheque reference, and the admin who recorded it.
   */
  async getDealerCreditLedger(dealerId: string) {
    const entries = await prisma.dealerCreditLedger.findMany({
      where: { dealerId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Batch-lookup all PaymentTransaction rows referenced by these ledger entries.
    const txnIds = entries
      .map((e) => e.paymentTxnId)
      .filter((id): id is string => Boolean(id));

    const txnMap = new Map<string, any>();
    if (txnIds.length > 0) {
      const txns = await prisma.paymentTransaction.findMany({
        where: { id: { in: txnIds } },
        select: {
          id: true,
          amount: true,
          paymentMethod: true,
          paymentSource: true,
          gatewayName: true,
          gatewayPaymentId: true,
          utrNumber: true,
          bankName: true,
          chequeNumber: true,
          paymentReceivedAt: true,
          status: true,
          notes: true,
          recordedBy: { select: { id: true, name: true, email: true } },
        },
      });
      txns.forEach((t) => txnMap.set(t.id, t));
    }

    // Batch-fetch Transaction IDs for every order in the ledger.
    // This lets the frontend build a clickable /dashboard/transactions/TXN-xxx link
    // from each credit ledger entry without a second round-trip.
    const ledgerOrderIds = entries
      .map((e) => e.orderId)
      .filter((id): id is string => Boolean(id));

    const orderTransactionMap = new Map<string, string>();
    if (ledgerOrderIds.length > 0) {
      const orderTxns = await prisma.transaction.findMany({
        where: { orderId: { in: ledgerOrderIds } },
        select: { id: true, orderId: true },
      });
      orderTxns.forEach((t) => orderTransactionMap.set(t.orderId, t.id));
    }

    const enrichedEntries = entries.map((entry) => ({
      ...entry,
      // null for ORDER_DELIVERED/ORDER_CANCELLED; populated for PAYMENT_RECEIVED.
      paymentTransaction: entry.paymentTxnId
        ? (txnMap.get(entry.paymentTxnId) ?? null)
        : null,
      // Transaction ID for the order — enables deep navigation to transaction detail page.
      transactionId: entry.orderId
        ? (orderTransactionMap.get(entry.orderId) ?? null)
        : null,
    }));

    const currentBalance =
      enrichedEntries.length > 0 ? enrichedEntries[0].balanceAfter : 0;

    return {
      entries: enrichedEntries,
      currentBalance,
      totalEntries: enrichedEntries.length,
    };
  }

  /**
   * Get order by ID (helper method)
   */
  async getOrderById(orderId: string): Promise<any> {
    return await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        orderItems: {
          include: {
            variant: {
              include: { product: true }
            }
          }
        },
        invoice: { where: { isLatest: true } },
        paymentTransactions: true
      }
    });
  }

  /**
   * Get payment audit trail for an order
   */
  async getOrderAuditTrail(orderId: string) {
    return await prisma.paymentAuditLog.findMany({
      where: { orderId },
      include: {
        actorUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        paymentTxn: {
          select: {
            id: true,
            paymentMethod: true,
            amount: true,
            status: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }
}