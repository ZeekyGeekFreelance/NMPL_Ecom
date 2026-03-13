import AppError from "@/shared/errors/AppError";
import { makeInvoiceService } from "../invoice/invoice.factory";
import { makeLogsService } from "../logs/logs.factory";
import {
  TransactionRepository,
  type TransactionQuotationItemUpdate,
} from "./transaction.repository";
import {
  toAccountReference,
  toOrderReference,
} from "@/shared/utils/accountReference";
import sendEmail from "@/shared/utils/sendEmail";
import {
  getPlatformName,
  getSupportEmail,
} from "@/shared/utils/branding";
import prisma from "@/infra/database/database.config";
import { ORDER_QUOTATION_LOG_EVENT, ROLE } from "@prisma/client";
import { formatDateTimeInIST } from "@/shared/utils/dateTime";
import {
  resolveCustomerTypeFromUser,
  resolveEffectiveRoleFromUser,
} from "@/shared/utils/userRole";
import {
  getReservationExpiryHours,
  ORDER_LIFECYCLE_STATUS,
  ORDER_STATUS_TRANSITIONS,
  type OrderLifecycleStatus,
} from "@/shared/utils/orderLifecycle";
import { config } from "@/config";

const userFacingStatusLabel: Record<OrderLifecycleStatus, string> = {
  PENDING_VERIFICATION: "Pending Verification",
  WAITLISTED: "Waitlisted",
  AWAITING_PAYMENT: "Awaiting Payment",
  QUOTATION_REJECTED: "Quotation Rejected",
  QUOTATION_EXPIRED: "Quotation Expired",
  CONFIRMED: "Confirmed",
  DELIVERED: "Delivered",
};

const statusEmailSubjectLine: Record<OrderLifecycleStatus, string> = {
  PENDING_VERIFICATION: "Order Received - Verification Pending",
  WAITLISTED: "Order Waitlisted",
  AWAITING_PAYMENT: "Quotation Approved - Payment Required",
  QUOTATION_REJECTED: "Quotation Rejected",
  QUOTATION_EXPIRED: "Quotation Expired",
  CONFIRMED: "Order Confirmed",
  DELIVERED: "Order Delivered",
};

const statusInstruction: Partial<Record<OrderLifecycleStatus, string>> = {
  PENDING_VERIFICATION:
    "Stock will be verified by our team before quotation approval.",
  WAITLISTED:
    "This order is currently waitlisted because stock is fully reserved.",
  AWAITING_PAYMENT:
    "Your quotation is approved and stock is reserved. Complete payment before reservation expiry.",
  QUOTATION_REJECTED:
    "The quotation has been rejected and any reserved stock has been released.",
  QUOTATION_EXPIRED:
    "The quotation expired before payment and reserved stock has been released.",
  CONFIRMED:
    "Payment has been received and your order is now confirmed.",
  DELIVERED:
    "Order has been marked as delivered.",
};

export class TransactionService {
  private logsService = makeLogsService();
  private invoiceService = makeInvoiceService();

  constructor(private transactionRepository: TransactionRepository) {}

  private async resolveTransactionId(identifier: string): Promise<string> {
    const normalized = String(identifier || "").trim();
    if (!normalized) {
      throw new AppError(400, "Transaction ID is required");
    }

    if (!normalized.toUpperCase().startsWith("TXN-")) {
      return normalized;
    }

    const transactionId = await this.transactionRepository.findIdByReference(
      normalized
    );
    if (!transactionId) {
      throw new AppError(404, "Transaction not found");
    }

    return transactionId;
  }

  private parseStatus(value: string): OrderLifecycleStatus {
    const normalized = value.trim().toUpperCase();
    const compact = normalized.replace(/[^A-Z]/g, "");

    const statusAliasMap: Record<string, OrderLifecycleStatus> = {
      PENDINGVERIFICATION: ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION,
      VERIFY: ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION,
      PLACED: ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION,
      PENDING: ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION,

      WAITLISTED: ORDER_LIFECYCLE_STATUS.WAITLISTED,
      WAITLIST: ORDER_LIFECYCLE_STATUS.WAITLISTED,

      AWAITINGPAYMENT: ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT,
      QUOTATIONAPPROVED: ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT,
      APPROVED: ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT,

      QUOTATIONREJECTED: ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
      REJECTED: ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
      CANCELED: ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
      CANCELLED: ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
      REFUNDED: ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
      RETURNED: ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,

      QUOTATIONEXPIRED: ORDER_LIFECYCLE_STATUS.QUOTATION_EXPIRED,
      EXPIRED: ORDER_LIFECYCLE_STATUS.QUOTATION_EXPIRED,

      CONFIRMED: ORDER_LIFECYCLE_STATUS.CONFIRMED,
      PAID: ORDER_LIFECYCLE_STATUS.CONFIRMED,
      DELIVERED: ORDER_LIFECYCLE_STATUS.DELIVERED,
    };

    const mapped = statusAliasMap[compact] || statusAliasMap[normalized];
    if (mapped) {
      return mapped;
    }

    throw new AppError(400, `Invalid status value: ${value}`);
  }

  private assertValidStatusTransition(
    currentStatus: OrderLifecycleStatus,
    nextStatus: OrderLifecycleStatus
  ) {
    if (currentStatus === nextStatus) {
      return;
    }

    const allowed = ORDER_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(nextStatus)) {
      throw new AppError(
        400,
        `Invalid status transition from ${currentStatus} to ${nextStatus}`
      );
    }
  }

  private resolvePortalUrl(): string {
    const configuredUrl = config.isProduction
      ? config.urls.clientProd
      : config.urls.clientDev;
    return configuredUrl.replace(/\/+$/, "");
  }

  private formatCurrency(value: number): string {
    const amount = Number(value);
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    return `INR ${safeAmount.toFixed(2)}`;
  }

  private normalizeQuotationLogLineItems(rawLineItems: unknown): Array<{
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }> {
    if (!Array.isArray(rawLineItems)) {
      return [];
    }

    return rawLineItems.map((entry) => {
      const row =
        entry && typeof entry === "object"
          ? (entry as Record<string, unknown>)
          : {};

      const quantity = Number(row.quantity);
      const unitPrice = Number(row.unitPrice);
      const explicitLineTotal = Number(row.lineTotal);

      const safeQuantity = Number.isFinite(quantity) ? quantity : 0;
      const safeUnitPrice = Number.isFinite(unitPrice) ? unitPrice : 0;
      const safeLineTotal = Number.isFinite(explicitLineTotal)
        ? explicitLineTotal
        : safeQuantity * safeUnitPrice;

      return {
        productName: String(row.productName || "Product").trim() || "Product",
        sku: String(row.sku || "N/A").trim() || "N/A",
        quantity: safeQuantity,
        unitPrice: safeUnitPrice,
        lineTotal: Number(safeLineTotal.toFixed(2)),
      };
    });
  }

  private async notifyQuotationIssued(params: {
    recipientEmail?: string | null;
    recipientName?: string | null;
    customerType: "USER" | "DEALER";
    accountReference: string;
    orderId: string;
    reservationExpiresAt?: Date | string | null;
    quotationItems: Array<{
      productName: string;
      sku: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>;
    originalOrderItems?: Array<{
      productName: string;
      sku: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>;
    originalOrderAmount?: number | null;
    quotedAmount: number;
  }): Promise<void> {
    const customerEmail = params.recipientEmail?.trim();
    if (!customerEmail) {
      return;
    }

    const platformName = getPlatformName();
    const supportEmail = getSupportEmail();
    const portalUrl = this.resolvePortalUrl();
    const orderReference = toOrderReference(params.orderId);
    const orderUrl = `${portalUrl}/orders/${orderReference}`;
    const payActionUrl = `${orderUrl}?quotationAction=pay`;
    const rejectActionUrl = `${orderUrl}?quotationAction=reject`;
    const actionTime = formatDateTimeInIST(new Date());
    const expiresAt = params.reservationExpiresAt
      ? formatDateTimeInIST(new Date(params.reservationExpiresAt))
      : "Not available";

    const normalizeItems = (
      rows: Array<{
        productName: string;
        sku: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
      }>
    ) =>
      rows.map((row) => ({
        productName: row.productName || "Product",
        sku: row.sku || "N/A",
        quantity: Number(row.quantity) || 0,
        unitPrice: Number(row.unitPrice) || 0,
        lineTotal: Number(row.lineTotal) || 0,
      }));

    const revisedItems = normalizeItems(params.quotationItems || []);
    const originalItemsInput =
      Array.isArray(params.originalOrderItems) && params.originalOrderItems.length
        ? params.originalOrderItems
        : revisedItems;
    const originalItems = normalizeItems(originalItemsInput);

    const originalAmountValue = Number(params.originalOrderAmount);
    const originalTotal = Number.isFinite(originalAmountValue)
      ? originalAmountValue
      : originalItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const quotedAmount = Number(params.quotedAmount) || 0;

    const toRowsText = (
      rows: Array<{
        productName: string;
        sku: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
      }>
    ) =>
      rows
        .map(
          (item, index) =>
            `${index + 1}. ${item.productName} (${item.sku}) - Qty: ${
              item.quantity
            }, Unit: ${this.formatCurrency(item.unitPrice)}, Line: ${this.formatCurrency(
              item.lineTotal
            )}`
        )
        .join("\n");

    const toRowsHtml = (
      rows: Array<{
        productName: string;
        sku: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
      }>
    ) =>
      rows
        .map(
          (item, index) => `
            <tr>
              <td style="padding:8px;border:1px solid #e5e7eb;">${index + 1}</td>
              <td style="padding:8px;border:1px solid #e5e7eb;">${item.productName}</td>
              <td style="padding:8px;border:1px solid #e5e7eb;">${item.sku}</td>
              <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${
                item.quantity
              }</td>
              <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${this.formatCurrency(
                item.unitPrice
              )}</td>
              <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${this.formatCurrency(
                item.lineTotal
              )}</td>
            </tr>
          `
        )
        .join("");

    const originalRowsText = toRowsText(originalItems);
    const revisedRowsText = toRowsText(revisedItems);
    const originalRowsHtml = toRowsHtml(originalItems);
    const revisedRowsHtml = toRowsHtml(revisedItems);

    const emptyRowsHtml = `
      <tr>
        <td colspan="6" style="padding:10px;border:1px solid #e5e7eb;text-align:center;color:#6b7280;">
          No line items available.
        </td>
      </tr>
    `;

    const renderQuotationTable = (
      heading: string,
      rowsHtml: string,
      totalLabel: string,
      totalValue: number
    ) => `
      <h3 style="margin:16px 0 8px 0;">${heading}</h3>
      <table style="border-collapse: collapse; width: 100%; margin: 0 0 12px 0;">
        <thead>
          <tr style="background-color:#f3f4f6;">
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">#</th>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Product</th>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">SKU</th>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:right;">Qty</th>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:right;">Unit Price</th>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:right;">Line Total</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || emptyRowsHtml}
        </tbody>
      </table>
      <p><strong>${totalLabel}:</strong> ${this.formatCurrency(totalValue)}</p>
    `;

    const originalSectionHtml = renderQuotationTable(
      "Original Order (Placed)",
      originalRowsHtml,
      "Original Total",
      originalTotal
    );

    const revisedSectionHtml = renderQuotationTable(
      "Revised Quotation",
      revisedRowsHtml,
      "Revised Total",
      quotedAmount
    );

    const sent = await sendEmail({
      to: customerEmail,
      subject: `${platformName} | Revised Quotation Ready (${orderReference})`,
      text: [
        `Hello ${params.recipientName?.trim() || "Customer"},`,
        "",
        `Your quotation is ready on ${platformName}.`,
        `Order ID: ${orderReference}`,
        `Account Reference: ${params.accountReference}`,
        `Customer Type: ${params.customerType}`,
        `Action Time (IST): ${actionTime}`,
        `Reservation Expires (IST): ${expiresAt}`,
        "",
        "Original Order (Placed):",
        originalRowsText || "No line items available.",
        `Original Total: ${this.formatCurrency(originalTotal)}`,
        "",
        "Revised Quotation:",
        revisedRowsText || "No line items available.",
        `Revised Total: ${this.formatCurrency(quotedAmount)}`,
        "",
        `Proceed to payment: ${payActionUrl}`,
        `Cancel quotation: ${rejectActionUrl}`,
        "",
        `Need help? Contact ${supportEmail}.`,
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
          <p>Hello <strong>${params.recipientName?.trim() || "Customer"}</strong>,</p>
          <p>Your revised quotation is ready on <strong>${platformName}</strong>.</p>
          <p>
            <strong>Order ID:</strong> ${orderReference}<br />
            <strong>Account Reference:</strong> ${params.accountReference}<br />
            <strong>Customer Type:</strong> ${params.customerType}<br />
            <strong>Action Time (IST):</strong> ${actionTime}<br />
            <strong>Reservation Expires (IST):</strong> ${expiresAt}
          </p>
          ${originalSectionHtml}
          ${revisedSectionHtml}
          <p style="margin: 20px 0;">
            <a href="${payActionUrl}" style="display:inline-block;padding:10px 14px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;margin-right:10px;">Proceed to Payment</a>
            <a href="${rejectActionUrl}" style="display:inline-block;padding:10px 14px;background:#dc2626;color:#ffffff;text-decoration:none;border-radius:6px;">Cancel Quotation</a>
          </p>
          <p>
            Need help? Contact
            <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>.
          </p>
        </div>
      `,
    });

    if (!sent) {
      throw new Error("Quotation email failed to send.");
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
    customerType: "USER" | "DEALER";
    accountReference: string;
    orderId: string;
    previousStatus: OrderLifecycleStatus;
    nextStatus: OrderLifecycleStatus;
    /** Override the default status instruction message (e.g. for pay-later variants). */
    customInstruction?: string;
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
    const instruction = params.customInstruction ?? statusInstruction[params.nextStatus];

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
            instruction ? `Next step: ${instruction}` : null,
            "",
            `For support, contact ${supportEmail}.`,
          ]
            .filter(Boolean)
            .join("\n"),
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
              ${
                instruction
                  ? `<p><strong>Next step:</strong> ${instruction}</p>`
                  : ""
              }
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
            `Customer Type: ${params.customerType}`,
            `Account Reference: ${params.accountReference}`,
            `Previous status: ${previousLabel.toUpperCase()}`,
            `Current status: ${currentLabel.toUpperCase()}`,
            `Action Time (IST): ${actionTime}`,
            instruction ? `Next step: ${instruction}` : null,
            "",
            "This is an automated copy for operational tracking.",
          ]
            .filter(Boolean)
            .join("\n"),
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
                <strong>Customer Type:</strong> ${params.customerType}<br />
                <strong>Account Reference:</strong> ${params.accountReference}<br />
                <strong>Previous status:</strong> ${previousLabel.toUpperCase()}<br />
                <strong>Current status:</strong> ${currentLabel.toUpperCase()}<br />
                <strong>Action Time (IST):</strong> ${actionTime}
              </p>
              ${
                instruction
                  ? `<p><strong>Next step:</strong> ${instruction}</p>`
                  : ""
              }
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

  private async notifyPromotedWaitlistedOrders(orderIds: string[]) {
    if (!orderIds.length) {
      return;
    }

    const promotedTransactions = await prisma.transaction.findMany({
      where: {
        orderId: {
          in: orderIds,
        },
      },
      include: {
        order: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                dealerProfile: {
                  select: {
                    status: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    for (const promoted of promotedTransactions) {
      const user = promoted.order?.user;
      if (!user) {
        continue;
      }

      await this.notifyOrderStatusChange({
        recipientEmail: user.email,
        recipientName: user.name,
        customerType:
          promoted.order.customerRoleSnapshot ||
          resolveCustomerTypeFromUser(user),
        accountReference: toAccountReference(user.id),
        orderId: promoted.orderId,
        previousStatus: ORDER_LIFECYCLE_STATUS.WAITLISTED,
        nextStatus: ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT,
      }).catch(async (error: unknown) => {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown email error";
        await this.logsService.warn(
          "Promoted waitlisted order email notification failed",
          {
            orderId: promoted.orderId,
            transactionId: promoted.id,
            error: errorMessage,
          }
        );
      });
    }
  }

  async processExpiredQuotations(): Promise<number> {
    const expiredTransactionIds =
      await this.transactionRepository.findExpiredAwaitingPaymentTransactionIds(
        new Date()
      );

    for (const transactionId of expiredTransactionIds) {
      try {
        const updated = await this.transactionRepository.updateTransaction(
          transactionId,
          {
            status: ORDER_LIFECYCLE_STATUS.QUOTATION_EXPIRED,
            reservationExpiryHours: getReservationExpiryHours(),
          }
        );

        const recipientEmail = updated.transaction.order?.user?.email || null;
        const recipientName = updated.transaction.order?.user?.name || "Customer";
        const recipientUserId = updated.transaction.order?.user?.id;
        const customerType =
          updated.transaction.order?.customerRoleSnapshot ||
          resolveCustomerTypeFromUser(updated.transaction.order?.user);
        const accountReference = recipientUserId
          ? toAccountReference(recipientUserId)
          : "N/A";

        await this.notifyOrderStatusChange({
          recipientEmail,
          recipientName,
          customerType,
          accountReference,
          orderId: updated.transaction.orderId,
          previousStatus: updated.previousStatus,
          nextStatus: ORDER_LIFECYCLE_STATUS.QUOTATION_EXPIRED,
        });

        await this.notifyPromotedWaitlistedOrders(updated.promotedOrderIds);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown expiry processing error";
        await this.logsService.error("Failed to expire overdue quotation", {
          transactionId,
          error: errorMessage,
        });
      }
    }

    return expiredTransactionIds.length;
  }

  async getAllTransactions(queryString: Record<string, any> = {}) {
    const hasExplicitPagination =
      queryString.page !== undefined || queryString.limit !== undefined;

    if (!hasExplicitPagination) {
      const transactions = await this.transactionRepository.findMany();
      const totalResults = transactions.length;
      return {
        transactions,
        totalResults,
        totalPages: totalResults > 0 ? 1 : 0,
        currentPage: 1,
        resultsPerPage: totalResults,
      };
    }

    const parsedPage = Number(queryString.page);
    const parsedLimit = Number(queryString.limit);
    const currentPage =
      Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;
    const resultsPerPage =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.floor(parsedLimit)
        : 16;
    const skip = (currentPage - 1) * resultsPerPage;

    const [transactions, totalResults] = await Promise.all([
      this.transactionRepository.findMany({
        skip,
        take: resultsPerPage,
      }),
      this.transactionRepository.countTransactions(),
    ]);

    const totalPages = Math.ceil(totalResults / resultsPerPage);

    return {
      transactions,
      totalResults,
      totalPages,
      currentPage,
      resultsPerPage,
    };
  }

  async getTransactionById(id: string) {
    const resolvedId = await this.resolveTransactionId(id);
    const transaction = await this.transactionRepository.findById(resolvedId);
    if (!transaction) {
      throw new AppError(404, "Transaction not found");
    }

    const userId = transaction.order?.user?.id;
    if (!userId || !transaction.order?.user) {
      return transaction;
    }

    const customerType =
      transaction.order.customerRoleSnapshot ||
      resolveCustomerTypeFromUser(transaction.order.user);

    return {
      ...transaction,
      order: {
        ...transaction.order,
        customerType,
        user: {
          ...transaction.order.user,
          accountReference: toAccountReference(userId),
          effectiveRole: resolveEffectiveRoleFromUser(transaction.order.user),
        },
      },
    };
  }

  async updateTransactionStatus(
    id: string,
    data: {
      status: string | OrderLifecycleStatus;
      forceConfirmedRejection?: boolean;
      confirmationToken?: string;
      quotationItems?: TransactionQuotationItemUpdate[];
      actorUserId?: string;
      actorRole?: string;
    }
  ) {
    const resolvedId = await this.resolveTransactionId(id);
    const existingTransaction = await this.transactionRepository.findById(
      resolvedId
    );
    if (!existingTransaction) {
      throw new AppError(404, "Transaction not found");
    }

    const previousStatus = this.parseStatus(String(existingTransaction.status));
    const requestedStatus = this.parseStatus(String(data.status));
    const isPayLaterOrder = !!(existingTransaction.order as any)?.isPayLater;
    const isPayLaterDeliveryOverride =
      isPayLaterOrder &&
      previousStatus === ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT &&
      requestedStatus === ORDER_LIFECYCLE_STATUS.DELIVERED;

    if (!isPayLaterDeliveryOverride) {
      this.assertValidStatusTransition(previousStatus, requestedStatus);
    }
    const actorRole = String(data.actorRole || "")
      .trim()
      .toUpperCase();
    const isAdminActor = actorRole === "ADMIN" || actorRole === "SUPERADMIN";
    const hasQuotationItems =
      Array.isArray(data.quotationItems) && data.quotationItems.length > 0;

    if (
      requestedStatus === ORDER_LIFECYCLE_STATUS.CONFIRMED &&
      isAdminActor &&
      !isPayLaterOrder
    ) {
      throw new AppError(
        400,
        "Manual payment confirmation is disabled. Order is auto-confirmed after successful payment."
      );
    }

    if (hasQuotationItems) {
      if (requestedStatus !== ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT) {
        throw new AppError(
          400,
          "Quotation updates can only be issued with AWAITING_PAYMENT status."
        );
      }

      const canIssueQuotationFromStatus =
        previousStatus === ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION ||
        previousStatus === ORDER_LIFECYCLE_STATUS.WAITLISTED;

      if (!canIssueQuotationFromStatus) {
        throw new AppError(
          400,
          `Quotation can be issued only from PENDING_VERIFICATION or WAITLISTED. Current status: ${previousStatus}`
        );
      }
    }

    if (previousStatus === requestedStatus && !hasQuotationItems) {
      return existingTransaction;
    }

    const updateResult = await this.transactionRepository.updateTransaction(
      resolvedId,
      {
        status: requestedStatus,
        reservationExpiryHours: getReservationExpiryHours(),
        actorUserId: data.actorUserId,
        actorRole: data.actorRole,
        ...(hasQuotationItems ? { quotationItems: data.quotationItems } : {}),
      }
    );

    const transaction = updateResult.transaction;
    const recipientEmail = transaction.order?.user?.email || null;
    const recipientName = transaction.order?.user?.name || "Customer";
    const recipientUserId = transaction.order?.user?.id;
    const customerType =
      transaction.order?.customerRoleSnapshot ||
      resolveCustomerTypeFromUser(transaction.order?.user);
    const accountReference = recipientUserId
      ? toAccountReference(recipientUserId)
      : "N/A";

    const issuedQuotation =
      hasQuotationItems &&
      updateResult.effectiveStatus === ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT;

    if (issuedQuotation) {
      const quotationItems = Array.isArray(transaction.order?.orderItems)
        ? transaction.order.orderItems.map((item: any) => ({
            productName: item.variant?.product?.name || "Product",
            sku: item.variant?.sku || item.variantId || "N/A",
            quantity: Number(item.quantity) || 0,
            unitPrice: Number(item.price) || 0,
            lineTotal: (Number(item.quantity) || 0) * (Number(item.price) || 0),
          }))
        : [];

      const originalOrderLog = Array.isArray(transaction.order?.quotationLogs)
        ? transaction.order.quotationLogs.find(
            (log: any) =>
              log?.event === ORDER_QUOTATION_LOG_EVENT.ORIGINAL_ORDER
          )
        : null;
      const originalOrderItems = this.normalizeQuotationLogLineItems(
        originalOrderLog?.lineItems
      );
      const originalOrderAmount = Number(originalOrderLog?.updatedTotal);

      await this.notifyQuotationIssued({
        recipientEmail,
        recipientName,
        customerType,
        accountReference,
        orderId: transaction.orderId,
        reservationExpiresAt:
          transaction.order?.reservation?.expiresAt ||
          transaction.order?.reservationExpiresAt,
        quotationItems,
        originalOrderItems:
          originalOrderItems.length > 0 ? originalOrderItems : quotationItems,
        originalOrderAmount: Number.isFinite(originalOrderAmount)
          ? originalOrderAmount
          : null,
        quotedAmount: Number(transaction.order?.amount) || 0,
      }).catch(async (error: unknown) => {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown email error";

        await this.logsService.warn("Quotation notification email failed", {
          transactionId: resolvedId,
          orderId: transaction.orderId,
          error: errorMessage,
        });
      });
    } else {
      // For pay-later orders confirmed without payment, override the default instruction
      // so the dealer email correctly reflects their credit terms (not "payment received").
      const isPayLaterConfirm =
        updateResult.effectiveStatus === ORDER_LIFECYCLE_STATUS.CONFIRMED &&
        !!(updateResult.transaction?.order as any)?.isPayLater;

      await this.notifyOrderStatusChange({
        recipientEmail,
        recipientName,
        customerType,
        accountReference,
        orderId: transaction.orderId,
        previousStatus: updateResult.previousStatus,
        nextStatus: updateResult.effectiveStatus,
        customInstruction: isPayLaterConfirm
          ? "Your order is confirmed under your pay-later credit terms. Payment will be due 30 days from the delivery date. An invoice will be sent upon delivery."
          : undefined,
      }).catch(async (error: unknown) => {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown email error";

        await this.logsService.warn("Order status notification email failed", {
          transactionId: resolvedId,
          orderId: transaction.orderId,
          error: errorMessage,
        });
      });
    }

    await this.notifyPromotedWaitlistedOrders(updateResult.promotedOrderIds);

    if (updateResult.effectiveStatus === ORDER_LIFECYCLE_STATUS.DELIVERED) {
      // Pass pay-later context so the invoice is created with PAYMENT_DUE status.
      const deliveredOrder = updateResult.transaction?.order as any;
      const isPayLaterOrder = !!(deliveredOrder?.isPayLater);
      const paymentDueDate = deliveredOrder?.paymentDueDate as Date | undefined;

      this.invoiceService
        .generateAndSendInvoiceForOrder(transaction.orderId, {
          isPayLater: isPayLaterOrder,
          paymentDueDate,
        })
        .catch(async (error: unknown) => {
          if (this.invoiceService.isInvoiceTableMissing(error)) {
            await this.logsService.warn(
              "Invoice table is missing. Skipping automated billing after order delivery.",
              { orderId: transaction.orderId }
            );
            return;
          }

          const errorMessage =
            error instanceof Error ? error.message : "Unknown invoice error";

          await this.logsService.error(
            "Automated invoice generation failed after order delivery",
            {
              orderId: transaction.orderId,
              transactionId: resolvedId,
              error: errorMessage,
            }
          );
        });
    }

    return transaction;
  }

  async issueQuotation(
    id: string,
    quotationItems: TransactionQuotationItemUpdate[],
    actor?: {
      actorUserId?: string;
      actorRole?: string;
    }
  ) {
    if (!Array.isArray(quotationItems) || quotationItems.length === 0) {
      throw new AppError(
        400,
        "Quotation update requires at least one line item."
      );
    }

    return this.updateTransactionStatus(id, {
      status: ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT,
      quotationItems,
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole,
    });
  }

  async deleteTransaction(id: string) {
    const resolvedId = await this.resolveTransactionId(id);
    await this.transactionRepository.deleteTransaction(resolvedId);
  }
}
