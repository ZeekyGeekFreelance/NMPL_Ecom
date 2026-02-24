import AppError from "@/shared/errors/AppError";
import { makeInvoiceService } from "../invoice/invoice.factory";
import { makeLogsService } from "../logs/logs.factory";
import { TransactionRepository } from "./transaction.repository";
import { TRANSACTION_STATUS } from "@prisma/client";
import { toAccountReference } from "@/shared/utils/accountReference";
import sendEmail from "@/shared/utils/sendEmail";
import { getPlatformName, getSupportEmail } from "@/shared/utils/branding";

const allowedStatusTransitions: Record<
  TRANSACTION_STATUS,
  TRANSACTION_STATUS[]
> = {
  PENDING: ["PROCESSING"],
  PROCESSING: ["IN_TRANSIT", "DELIVERED"],
  SHIPPED: ["IN_TRANSIT", "DELIVERED"],
  IN_TRANSIT: ["DELIVERED"],
  DELIVERED: [],
  CANCELED: [],
  RETURNED: [],
  REFUNDED: [],
};

const userFacingStatusLabel: Record<TRANSACTION_STATUS, string> = {
  PENDING: "Order Placed",
  PROCESSING: "Confirmed",
  SHIPPED: "Out for Delivery",
  IN_TRANSIT: "Out for Delivery",
  DELIVERED: "Delivered",
  CANCELED: "Canceled",
  RETURNED: "Returned",
  REFUNDED: "Refunded",
};

export class TransactionService {
  private logsService = makeLogsService();
  private invoiceService = makeInvoiceService();

  constructor(private transactionRepository: TransactionRepository) {}

  private assertValidStatusTransition(
    currentStatus: TRANSACTION_STATUS,
    nextStatus: TRANSACTION_STATUS
  ) {
    if (currentStatus === nextStatus) {
      return;
    }

    const allowed = allowedStatusTransitions[currentStatus] || [];
    if (!allowed.includes(nextStatus)) {
      throw new AppError(
        400,
        `Invalid status transition from ${currentStatus} to ${nextStatus}`
      );
    }
  }

  private async notifyOrderStatusChange(params: {
    recipientEmail: string;
    recipientName: string;
    accountReference: string;
    orderId: string;
    previousStatus: TRANSACTION_STATUS;
    nextStatus: TRANSACTION_STATUS;
  }) {
    const platformName = getPlatformName();
    const supportEmail = getSupportEmail();
    const currentLabel = userFacingStatusLabel[params.nextStatus];
    const previousLabel = userFacingStatusLabel[params.previousStatus];

    await sendEmail({
      to: params.recipientEmail,
      subject: `${platformName} | Order Status Updated (${currentLabel})`,
      text: [
        `Hello ${params.recipientName},`,
        "",
        `Your order status has been updated on ${platformName}.`,
        `Order ID: ${params.orderId}`,
        `Account Reference: ${params.accountReference}`,
        `Previous status: ${previousLabel}`,
        `Current status: ${currentLabel}`,
        "",
        `For support, contact ${supportEmail}.`,
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
          <p>Hello <strong>${params.recipientName}</strong>,</p>
          <p>Your order status has been updated on <strong>${platformName}</strong>.</p>
          <p>
            <strong>Order ID:</strong> ${params.orderId}<br />
            <strong>Account Reference:</strong> ${params.accountReference}<br />
            <strong>Previous status:</strong> ${previousLabel}<br />
            <strong>Current status:</strong> ${currentLabel}
          </p>
          <p>
            For support, contact
            <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>.
          </p>
        </div>
      `,
    });
  }

  async getAllTransactions() {
    const transactions = await this.transactionRepository.findMany();
    return transactions;
  }

  async getTransactionById(id: string) {
    const transaction = await this.transactionRepository.findById(id);
    if (!transaction) {
      throw new AppError(404, "Transaction not found");
    }

    const userId = transaction.order?.user?.id;
    if (!userId) {
      return transaction;
    }

    return {
      ...transaction,
      order: {
        ...transaction.order,
        user: {
          ...transaction.order.user,
          accountReference: toAccountReference(userId),
        },
      },
    };
  }

  async updateTransactionStatus(
    id: string,
    data: { status: TRANSACTION_STATUS }
  ) {
    const existingTransaction = await this.transactionRepository.findById(id);
    if (!existingTransaction) {
      throw new AppError(404, "Transaction not found");
    }

    const previousStatus = existingTransaction.status as TRANSACTION_STATUS;
    const nextStatus = data.status;

    this.assertValidStatusTransition(previousStatus, nextStatus);

    if (previousStatus === nextStatus) {
      return existingTransaction;
    }

    const transaction = await this.transactionRepository.updateTransaction(id, data);

    const recipientEmail = transaction.order?.user?.email;
    const recipientName = transaction.order?.user?.name || "Customer";
    const recipientUserId = transaction.order?.user?.id;

    if (recipientEmail && recipientUserId) {
      await this.notifyOrderStatusChange({
        recipientEmail,
        recipientName,
        accountReference: toAccountReference(recipientUserId),
        orderId: transaction.orderId,
        previousStatus,
        nextStatus,
      }).catch(async (error: unknown) => {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown email error";

        await this.logsService.warn(
          "Order status notification email failed",
          {
            transactionId: id,
            orderId: transaction.orderId,
            error: errorMessage,
          }
        );
      });
    }

    if (
      previousStatus === TRANSACTION_STATUS.PENDING &&
      nextStatus === TRANSACTION_STATUS.PROCESSING
    ) {
      this.invoiceService
        .generateAndSendInvoiceForOrder(transaction.orderId)
        .catch(async (error: unknown) => {
          if (this.invoiceService.isInvoiceTableMissing(error)) {
            await this.logsService.warn(
              "Invoice table is missing. Skipping automated billing after order confirmation.",
              { orderId: transaction.orderId }
            );
            return;
          }

          const errorMessage =
            error instanceof Error ? error.message : "Unknown invoice error";

          await this.logsService.error(
            "Automated invoice generation failed after order confirmation",
            {
              orderId: transaction.orderId,
              transactionId: id,
              error: errorMessage,
            }
          );
        });
    }

    return transaction;
  }

  async deleteTransaction(id: string) {
    await this.transactionRepository.deleteTransaction(id);
  }
}
