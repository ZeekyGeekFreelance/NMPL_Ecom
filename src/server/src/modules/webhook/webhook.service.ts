import stripe, { isStripeConfigured } from "@/infra/payment/stripe";
import AppError from "@/shared/errors/AppError";
import { makeLogsService } from "../logs/logs.factory";
import prisma from "@/infra/database/database.config";
import { TransactionRepository } from "../transaction/transaction.repository";
import { TransactionService } from "../transaction/transaction.service";
import { ORDER_LIFECYCLE_STATUS } from "@/shared/utils/orderLifecycle";

export class WebhookService {
  private logsService = makeLogsService();
  private transactionService = new TransactionService(
    new TransactionRepository()
  );

  async handleCheckoutCompletion(session: any) {
    if (!isStripeConfigured || !stripe) {
      throw new AppError(503, "Stripe is not configured.");
    }

    const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["customer_details", "line_items"],
    });

    const orderId = fullSession?.metadata?.orderId;
    if (!orderId) {
      throw new AppError(
        400,
        "Missing orderId in checkout metadata. Direct payment confirmation is not allowed."
      );
    }

    const transaction = await prisma.transaction.findUnique({
      where: {
        orderId,
      },
      include: {
        order: {
          select: {
            id: true,
            amount: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new AppError(404, "Transaction not found for this order.");
    }

    const currentStatus = String(transaction.status || "").toUpperCase();
    if (
      currentStatus === ORDER_LIFECYCLE_STATUS.CONFIRMED ||
      currentStatus === ORDER_LIFECYCLE_STATUS.DELIVERED
    ) {
      await this.logsService.info("Webhook - Duplicate confirmation ignored", {
        sessionId: session.id,
        orderId,
        transactionId: transaction.id,
      });

      return {
        transaction,
      };
    }

    if (currentStatus !== ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT) {
      throw new AppError(
        409,
        `Payment cannot confirm order in ${currentStatus} status.`
      );
    }

    const amountInSession = (fullSession.amount_total ?? 0) / 100;
    if (
      transaction.order &&
      Math.abs(transaction.order.amount - amountInSession) > 0.01
    ) {
      throw new AppError(400, "Amount mismatch between quotation and payment.");
    }

    await prisma.payment.updateMany({
      where: {
        orderId,
      },
      data: {
        method: fullSession.payment_method_types?.[0] || "STRIPE",
      },
    });

    const updatedTransaction = await this.transactionService.updateTransactionStatus(
      transaction.id,
      {
        status: ORDER_LIFECYCLE_STATUS.CONFIRMED,
        actorRole: "SYSTEM",
      }
    );

    await this.logsService.info("Webhook - Payment confirmed order", {
      sessionId: session.id,
      orderId,
      transactionId: transaction.id,
      finalStatus: updatedTransaction.status,
    });

    return {
      transaction: updatedTransaction,
    };
  }
}
