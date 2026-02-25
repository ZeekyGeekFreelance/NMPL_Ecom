import AppError from "@/shared/errors/AppError";
import { makeInvoiceService } from "../invoice/invoice.factory";
import { makeLogsService } from "../logs/logs.factory";
import { TransactionRepository } from "./transaction.repository";
import {
  toAccountReference,
  toOrderReference,
} from "@/shared/utils/accountReference";
import sendEmail from "@/shared/utils/sendEmail";
import { getPlatformName, getSupportEmail } from "@/shared/utils/branding";
import prisma from "@/infra/database/database.config";
import { ROLE } from "@prisma/client";
import { formatDateTimeInIST } from "@/shared/utils/dateTime";

type TransactionLifecycleStatus =
  | "PLACED"
  | "CONFIRMED"
  | "REJECTED"
  | "DELIVERED";

const allowedStatusTransitions: Record<
  TransactionLifecycleStatus,
  TransactionLifecycleStatus[]
> = {
  PLACED: ["CONFIRMED", "REJECTED"],
  CONFIRMED: ["DELIVERED", "REJECTED"],
  REJECTED: [],
  DELIVERED: [],
};

const userFacingStatusLabel: Record<TransactionLifecycleStatus, string> = {
  PLACED: "Placed",
  CONFIRMED: "Confirmed",
  REJECTED: "Cancelled",
  DELIVERED: "Delivered",
};

const statusEmailSubjectLine: Record<TransactionLifecycleStatus, string> = {
  PLACED: "Your Order Has Been Placed",
  CONFIRMED: "Your Order Has Been Confirmed",
  REJECTED: "Your Order Has Been Cancelled",
  DELIVERED: "Your Order Has Been Delivered",
};

export class TransactionService {
  private logsService = makeLogsService();
  private invoiceService = makeInvoiceService();

  constructor(private transactionRepository: TransactionRepository) {}

  private parseStatus(value: string): TransactionLifecycleStatus {
    const normalized = value.trim().toUpperCase();
    const compact = normalized.replace(/[^A-Z]/g, "");

    const statusAliasMap: Record<string, TransactionLifecycleStatus> = {
      PLACED: "PLACED",
      PLACE: "PLACED",
      ORDERPLACED: "PLACED",
      PENDING: "PLACED",

      CONFIRMED: "CONFIRMED",
      CONFIRM: "CONFIRMED",
      CONFIRMORDER: "CONFIRMED",
      PROCESSING: "CONFIRMED",
      SHIPPED: "CONFIRMED",
      INTRANSIT: "CONFIRMED",

      REJECTED: "REJECTED",
      REJECT: "REJECTED",
      REJECTORDER: "REJECTED",
      CANCELED: "REJECTED",
      CANCELLED: "REJECTED",
      RETURNED: "REJECTED",
      REFUNDED: "REJECTED",

      DELIVERED: "DELIVERED",
      DELIVER: "DELIVERED",
    };

    const mapped = statusAliasMap[compact] || statusAliasMap[normalized];
    if (mapped) {
      return mapped;
    }

    throw new AppError(400, `Invalid status value: ${value}`);
  }

  private assertValidStatusTransition(
    currentStatus: TransactionLifecycleStatus,
    nextStatus: TransactionLifecycleStatus
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

  private async getAdminStatusCopyRecipients(
    excludeEmail?: string | null
  ): Promise<Array<{ email: string; name: string; role: ROLE }>> {
    const admins = await prisma.user.findMany({
      where: {
        role: {
          in: [ROLE.ADMIN, ROLE.SUPERADMIN],
        },
      },
      select: {
        email: true,
        name: true,
        role: true,
      },
    });

    const normalizedExcludeEmail = excludeEmail?.trim().toLowerCase();
    const dedupe = new Set<string>();
    const recipients: Array<{ email: string; name: string; role: ROLE }> = [];

    for (const admin of admins) {
      const normalizedEmail = admin.email?.trim().toLowerCase();
      if (!normalizedEmail) {
        continue;
      }

      if (
        normalizedExcludeEmail &&
        normalizedEmail === normalizedExcludeEmail
      ) {
        continue;
      }

      if (dedupe.has(normalizedEmail)) {
        continue;
      }

      dedupe.add(normalizedEmail);
      recipients.push({
        email: admin.email.trim(),
        name: admin.name || "Admin",
        role: admin.role,
      });
    }

    return recipients;
  }

  private async notifyOrderStatusChange(params: {
    recipientEmail?: string | null;
    recipientName?: string | null;
    accountReference: string;
    orderId: string;
    previousStatus: TransactionLifecycleStatus;
    nextStatus: TransactionLifecycleStatus;
  }) {
    const platformName = getPlatformName();
    const supportEmail = getSupportEmail();
    const currentLabel = userFacingStatusLabel[params.nextStatus];
    const previousLabel = userFacingStatusLabel[params.previousStatus];
    const subjectLine = statusEmailSubjectLine[params.nextStatus];
    const customerName = params.recipientName?.trim() || "Customer";
    const notificationPromises: Promise<boolean>[] = [];
    const customerEmail = params.recipientEmail?.trim() || null;
    const orderReference = toOrderReference(params.orderId);
    const actionTime = formatDateTimeInIST(new Date());

    if (customerEmail) {
      notificationPromises.push(
        sendEmail({
          to: customerEmail,
          subject: `${platformName} | ${subjectLine}`,
          text: [
            `Hello ${customerName},`,
            "",
            `Your order has been updated on ${platformName}.`,
            `Order ID: ${orderReference}`,
            `Account Reference: ${params.accountReference}`,
            `Previous status: ${previousLabel.toUpperCase()}`,
            `Current status: ${currentLabel.toUpperCase()}`,
            `Action Time (IST): ${actionTime}`,
            "",
            `For support, contact ${supportEmail}.`,
          ].join("\n"),
          html: `
            <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
              <p>Hello <strong>${customerName}</strong>,</p>
              <p>Your order has been updated on <strong>${platformName}</strong>.</p>
              <p>
                <strong>Order ID:</strong> ${orderReference}<br />
                <strong>Account Reference:</strong> ${params.accountReference}<br />
                <strong>Previous status:</strong> ${previousLabel.toUpperCase()}<br />
                <strong>Current status:</strong> ${currentLabel.toUpperCase()}<br />
                <strong>Action Time (IST):</strong> ${actionTime}
              </p>
              <p>
                For support, contact
                <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>.
              </p>
            </div>
          `,
        })
      );
    }

    const roleCopyRecipients = await this.getAdminStatusCopyRecipients(
      customerEmail
    );
    for (const recipient of roleCopyRecipients) {
      notificationPromises.push(
        sendEmail({
          to: recipient.email,
          subject: `${platformName} | Order Status Updated (${currentLabel.toUpperCase()})`,
          text: [
            `Hello ${recipient.name},`,
            "",
            `An order status has been updated on ${platformName}.`,
            `Order ID: ${orderReference}`,
            `Customer: ${customerName}`,
            `Customer Email: ${customerEmail || "Not available"}`,
            `Account Reference: ${params.accountReference}`,
            `Previous status: ${previousLabel.toUpperCase()}`,
            `Current status: ${currentLabel.toUpperCase()}`,
            `Action Time (IST): ${actionTime}`,
            `Recipient role: ${recipient.role}`,
            "",
            "This is an automated copy for operational tracking.",
          ].join("\n"),
          html: `
            <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
              <p>Hello <strong>${recipient.name}</strong>,</p>
              <p>An order status has been updated on <strong>${platformName}</strong>.</p>
              <p>
                <strong>Order ID:</strong> ${orderReference}<br />
                <strong>Customer:</strong> ${customerName}<br />
                <strong>Customer Email:</strong> ${
                  customerEmail || "Not available"
                }<br />
                <strong>Account Reference:</strong> ${params.accountReference}<br />
                <strong>Previous status:</strong> ${previousLabel.toUpperCase()}<br />
                <strong>Current status:</strong> ${currentLabel.toUpperCase()}<br />
                <strong>Action Time (IST):</strong> ${actionTime}<br />
                <strong>Recipient role:</strong> ${recipient.role}
              </p>
              <p>This is an automated copy for operational tracking.</p>
            </div>
          `,
        })
      );
    }

    if (!notificationPromises.length) {
      return;
    }

    const results = await Promise.allSettled(notificationPromises);
    const hasFailure = results.some(
      (result) =>
        result.status === "rejected" ||
        (result.status === "fulfilled" && result.value === false)
    );

    if (hasFailure) {
      throw new Error("One or more order status notification emails failed.");
    }
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
    data: {
      status: string | TransactionLifecycleStatus;
      forceConfirmedRejection?: boolean;
      confirmationToken?: string;
    }
  ) {
    const existingTransaction = await this.transactionRepository.findById(id);
    if (!existingTransaction) {
      throw new AppError(404, "Transaction not found");
    }

    const previousStatus = this.parseStatus(
      String(existingTransaction.status)
    );
    const nextStatus = this.parseStatus(String(data.status));

    const requiresConfirmedRejectionSafeguard =
      previousStatus === "CONFIRMED" && nextStatus === "REJECTED";

    if (
      requiresConfirmedRejectionSafeguard &&
      (!data.forceConfirmedRejection ||
        data.confirmationToken !== "CONFIRMED_ORDER_REJECTION")
    ) {
      throw new AppError(
        409,
        "This order has already been confirmed. Rejection requires additional confirmation."
      );
    }

    this.assertValidStatusTransition(previousStatus, nextStatus);

    if (previousStatus === nextStatus) {
      return existingTransaction;
    }

    const transaction = await this.transactionRepository.updateTransaction(id, {
      status: nextStatus,
    });

    const recipientEmail = transaction.order?.user?.email || null;
    const recipientName = transaction.order?.user?.name || "Customer";
    const recipientUserId = transaction.order?.user?.id;
    const accountReference = recipientUserId
      ? toAccountReference(recipientUserId)
      : "N/A";

    await this.notifyOrderStatusChange({
      recipientEmail,
      recipientName,
      accountReference,
      orderId: transaction.orderId,
      previousStatus,
      nextStatus,
    }).catch(async (error: unknown) => {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown email error";

      await this.logsService.warn("Order status notification email failed", {
        transactionId: id,
        orderId: transaction.orderId,
        error: errorMessage,
      });
    });

    if (
      previousStatus === "PLACED" &&
      nextStatus === "CONFIRMED"
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
