import AppError from "@/shared/errors/AppError";
import sendEmail from "@/shared/utils/sendEmail";
import { makeLogsService } from "@/modules/logs/logs.factory";
import { buildInvoiceEmailTemplate } from "@/shared/templates/invoiceEmail";
import generateInvoicePdf from "@/shared/utils/invoice/generateInvoicePdf";
import { getPlatformName } from "@/shared/utils/branding";
import {
  toAccountReference,
  toOrderReference,
} from "@/shared/utils/accountReference";
import { InvoiceRepository, InvoiceWithDetails } from "./invoice.repository";
import { resolveCustomerTypeFromUser } from "@/shared/utils/userRole";
import { ORDER_LIFECYCLE_STATUS } from "@/shared/utils/orderLifecycle";
import { getPickupLocationSnapshot } from "@/shared/utils/pricing/checkoutPricing";
import { config } from "@/config";
import { resolveBillingNotificationEmails } from "@/shared/utils/billingNotificationEmails";

interface RequesterContext {
  id: string;
  role: string;
}

export class InvoiceService {
  private logsService = makeLogsService();

  constructor(private invoiceRepository: InvoiceRepository) {}

  isInvoiceTableMissing(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    return (
      error.message.includes('relation "Invoice" does not exist') ||
      error.message.includes('relation "InvoiceCounter" does not exist')
    );
  }

  private isAdminRole(role: string): boolean {
    return role === "ADMIN" || role === "SUPERADMIN";
  }

  private assertRequester(requester?: RequesterContext): asserts requester is RequesterContext {
    if (!requester?.id || !requester?.role) {
      throw new AppError(401, "Unauthorized request");
    }
  }

  private assertOrderAccess(
    ownerUserId: string,
    requester: RequesterContext
  ): void {
    if (this.isAdminRole(requester.role)) {
      return;
    }

    if (
      (requester.role === "USER" || requester.role === "DEALER") &&
      requester.id === ownerUserId
    ) {
      return;
    }

    throw new AppError(403, "You are not authorized to access this invoice.");
  }

  private async getInternalRecipients(customerEmail: string): Promise<string[]> {
    const configuredRecipients = (await resolveBillingNotificationEmails()).emails;

    const fallback = config.email.smtpUser?.trim() ? [config.email.smtpUser.trim()] : [];

    const recipients =
      configuredRecipients.length > 0 ? configuredRecipients : fallback;

    const customerEmailLower = customerEmail.toLowerCase();

    return Array.from(
      new Set(
        recipients.filter(
          (email) => email.toLowerCase() !== customerEmailLower
        )
      )
    );
  }

  private getCustomerCopyLabel(invoice: InvoiceWithDetails): string {
    return this.resolveCustomerType(invoice) === "DEALER"
      ? "Dealer Copy"
      : "User Copy";
  }

  private resolveCustomerType(invoice: InvoiceWithDetails): "DEALER" | "USER" {
    if (invoice.order.customerRoleSnapshot === "DEALER") {
      return "DEALER";
    }

    if (invoice.order.customerRoleSnapshot === "USER") {
      return "USER";
    }

    return resolveCustomerTypeFromUser(invoice.user);
  }

  private normalizeLifecycleStatus(value?: string | null): string {
    const normalizedValue = String(value || "")
      .trim()
      .toUpperCase();

    const normalizedStatusByLegacyValue: Record<string, string> = {
      PLACED: ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION,
      PENDING: ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION,
      PROCESSING: ORDER_LIFECYCLE_STATUS.CONFIRMED,
      SHIPPED: ORDER_LIFECYCLE_STATUS.CONFIRMED,
      IN_TRANSIT: ORDER_LIFECYCLE_STATUS.CONFIRMED,
      PAID: ORDER_LIFECYCLE_STATUS.CONFIRMED,
      DELIVERED: ORDER_LIFECYCLE_STATUS.DELIVERED,
      REJECTED: ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
      CANCELED: ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
      RETURNED: ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
      REFUNDED: ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
    };

    return normalizedStatusByLegacyValue[normalizedValue] || normalizedValue;
  }

  private isInvoiceEligibleFromOrder(order: Awaited<ReturnType<InvoiceRepository["findOrderForInvoice"]>>): boolean {
    if (!order) {
      return false;
    }

    if (order.invoice) {
      return true;
    }

    const candidateStatuses = [
      this.normalizeLifecycleStatus(order.transaction?.status),
      this.normalizeLifecycleStatus(order.status),
    ];

    if (order.payment?.status === "PAID") {
      candidateStatuses.push(ORDER_LIFECYCLE_STATUS.CONFIRMED);
    }

    if (
      Array.isArray(order.paymentTransactions) &&
      order.paymentTransactions.some((transaction) => transaction.status === "CONFIRMED")
    ) {
      candidateStatuses.push(ORDER_LIFECYCLE_STATUS.CONFIRMED);
    }

    return candidateStatuses.some(
      (status) =>
        status === ORDER_LIFECYCLE_STATUS.CONFIRMED ||
        status === ORDER_LIFECYCLE_STATUS.DELIVERED
    );
  }

  private async sendInvoiceEmails(invoice: InvoiceWithDetails): Promise<void> {
    const internalRecipients = await this.getInternalRecipients(
      invoice.customerEmail
    );
    const shouldSendCustomerCopy = !invoice.customerEmailSentAt;
    const shouldSendInternalCopy =
      internalRecipients.length > 0 && !invoice.internalEmailSentAt;

    if (!shouldSendCustomerCopy && !shouldSendInternalCopy) {
      return;
    }

    const pdfBuffer = await this.buildInvoicePdf(invoice);
    const copyLabel = this.getCustomerCopyLabel(invoice);
    const customerType = this.resolveCustomerType(invoice);
    const platformName = getPlatformName();
    const accountReference = toAccountReference(invoice.user.id);
    const orderReference = toOrderReference(invoice.orderId);
    const invoiceAttachmentName = `${invoice.invoiceNumber}_${orderReference}.pdf`;

    let customerEmailSent = !shouldSendCustomerCopy;
    let internalEmailSent = !shouldSendInternalCopy;
    const errors: string[] = [];

    if (shouldSendCustomerCopy) {
      const customerTemplate = buildInvoiceEmailTemplate({
        recipientName: invoice.user.name,
        accountReference,
        copyLabel,
        invoiceNumber: invoice.invoiceNumber,
        orderId: orderReference,
        customerType,
        orderDate: invoice.order.orderDate,
        subtotalAmount: Number(invoice.order.subtotalAmount || 0),
        deliveryCharge: Number(invoice.order.deliveryCharge || 0),
        deliveryMode: String(invoice.order.deliveryMode || "DELIVERY"),
        totalAmount: invoice.order.amount,
        paymentStatus: invoice.paymentStatus,
        paymentTerms: invoice.paymentTerms,
        paymentDueDate: invoice.paymentDueDate,
      });

      customerEmailSent = await sendEmail({
        to: invoice.customerEmail,
        subject: `${platformName} | ${invoice.invoiceNumber} | ${copyLabel}`,
        text: customerTemplate.text,
        html: customerTemplate.html,
        attachments: [
          {
            filename: invoiceAttachmentName,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      });

      if (!customerEmailSent) {
        errors.push("Failed to send customer invoice email.");
      }
    }

    if (shouldSendInternalCopy && internalRecipients.length > 0) {
      const internalTemplate = buildInvoiceEmailTemplate({
        recipientName: "Billing Team",
        accountReference,
        copyLabel: "Billing Copy",
        invoiceNumber: invoice.invoiceNumber,
        orderId: orderReference,
        customerType,
        orderDate: invoice.order.orderDate,
        subtotalAmount: Number(invoice.order.subtotalAmount || 0),
        deliveryCharge: Number(invoice.order.deliveryCharge || 0),
        deliveryMode: String(invoice.order.deliveryMode || "DELIVERY"),
        totalAmount: invoice.order.amount,
        paymentStatus: invoice.paymentStatus,
        paymentTerms: invoice.paymentTerms,
        paymentDueDate: invoice.paymentDueDate,
      });

      const internalResults = await Promise.all(
        internalRecipients.map((recipient) =>
          sendEmail({
            to: recipient,
            subject: `${platformName} | ${invoice.invoiceNumber} | Billing Copy`,
            text: internalTemplate.text,
            html: internalTemplate.html,
            attachments: [
              {
                filename: invoiceAttachmentName,
                content: pdfBuffer,
                contentType: "application/pdf",
              },
            ],
          })
        )
      );

      internalEmailSent = internalResults.every(Boolean);

      if (!internalEmailSent) {
        errors.push("Failed to send internal billing invoice email.");
      }
    }

    await this.invoiceRepository.updateInvoiceEmailStatus(invoice.id, {
      customerEmailSentAt: customerEmailSent
        ? new Date()
        : invoice.customerEmailSentAt,
      internalEmailSentAt: internalEmailSent
        ? new Date()
        : invoice.internalEmailSentAt,
      lastEmailError: errors.length ? errors.join(" ") : null,
    });
  }

  private async ensureInvoiceForOrder(
    orderId: string,
    options?: {
      sendEmails?: boolean;
      /** True when the order is a pay-later order; invoice is created with PAYMENT_DUE status. */
      isPayLater?: boolean;
      /** Payment due date for pay-later invoices (set by transaction repo at delivery). */
      paymentDueDate?: Date;
    }
  ): Promise<InvoiceWithDetails> {
    const order = await this.invoiceRepository.findOrderForInvoice(orderId);

    if (!order) {
      throw new AppError(404, "Order not found");
    }

    if (!this.isInvoiceEligibleFromOrder(order)) {
      throw new AppError(
        409,
        "Invoice is available only after payment is confirmed."
      );
    }

    // For pay-later orders: create invoice with PAYMENT_DUE status and due date.
    // For prepaid orders: paymentStatus defaults to PAID (no fields needed).
    const invoice =
      (await this.invoiceRepository.findInvoiceByOrderId(orderId)) ||
      (await this.invoiceRepository.ensureInvoiceRecord({
        orderId,
        userId: order.userId,
        customerEmail: order.user.email,
        year: new Date().getFullYear(),
        ...(options?.isPayLater
          ? {
              paymentStatus: "PAYMENT_DUE",
              paymentDueDate: options.paymentDueDate,
              paymentTerms: "NET 30 from delivery date",
            }
          : {}),
      }));

    if (options?.sendEmails !== false) {
      await this.sendInvoiceEmails(invoice);
    }

    return invoice;
  }

  private async buildInvoicePdf(invoice: InvoiceWithDetails): Promise<Buffer> {
    const items = invoice.order.orderItems.map((item) => ({
      productName: item.variant.product.name,
      sku: item.variant.sku,
      quantity: item.quantity,
      unitPrice: item.price,
      subtotal: item.price * item.quantity,
    }));

    const paymentTransactions = Array.isArray(invoice.paymentTransactions)
      ? invoice.paymentTransactions.filter(
          (transaction) => transaction.status === "CONFIRMED"
        )
      : [];

    const customerType = this.resolveCustomerType(invoice);
    const normalizedDeliveryMode = String(
      invoice.order.deliveryMode || "DELIVERY"
    )
      .trim()
      .toUpperCase();
    const isPickup = normalizedDeliveryMode === "PICKUP";
    const snapshotAddress = invoice.order.address;
    const pickupLocation = isPickup ? getPickupLocationSnapshot() : null;
    const locationAddress = snapshotAddress
      ? {
          fullName: snapshotAddress.fullName,
          phoneNumber: snapshotAddress.phoneNumber,
          line1: snapshotAddress.line1,
          line2: snapshotAddress.line2,
          landmark: snapshotAddress.landmark,
          city: snapshotAddress.city,
          state: snapshotAddress.state,
          pincode: snapshotAddress.pincode,
          country: snapshotAddress.country,
        }
      : isPickup
      ? {
          // Legacy compatibility only: modern orders always snapshot pickup address.
          fullName: pickupLocation?.fullName,
          phoneNumber: pickupLocation?.phoneNumber,
          line1: pickupLocation?.line1 || "",
          line2: pickupLocation?.line2 || null,
          landmark: pickupLocation?.landmark || null,
          city: pickupLocation?.city || "",
          state: pickupLocation?.state || "",
          pincode: pickupLocation?.pincode || "",
          country: pickupLocation?.country || "",
        }
      : null;

    return generateInvoicePdf({
      invoiceNumber: invoice.invoiceNumber,
      orderId: toOrderReference(invoice.orderId),
      orderDate: invoice.order.orderDate,
      customerName: invoice.user.name,
      customerPhone: invoice.user.phone || invoice.order.address?.phoneNumber || null,
      accountReference: toAccountReference(invoice.user.id),
      customerEmail: invoice.customerEmail,
      customerType,
      items,
      subtotalAmount: Number(invoice.order.subtotalAmount || 0),
      deliveryCharge: Number(invoice.order.deliveryCharge || 0),
      deliveryMode: normalizedDeliveryMode,
      totalAmount: invoice.order.amount,
      paymentStatus: invoice.paymentStatus,
      paymentTerms: invoice.paymentTerms,
      paymentDueDate: invoice.paymentDueDate,
      paymentTransactions,
      locationLabel: isPickup ? "Pickup Location" : "Delivery To",
      locationAddress,
    });
  }

  async generateAndSendInvoiceForOrder(
    orderId: string,
    options?: { isPayLater?: boolean; paymentDueDate?: Date }
  ): Promise<InvoiceWithDetails> {
    const invoice = await this.ensureInvoiceForOrder(orderId, {
      sendEmails: true,
      isPayLater: options?.isPayLater,
      paymentDueDate: options?.paymentDueDate,
    });

    await this.logsService.info("Invoice generated successfully", {
      orderId,
      invoiceNumber: invoice.invoiceNumber,
      customerEmail: invoice.customerEmail,
    });

    return invoice;
  }

  async getAllInvoices() {
    return this.invoiceRepository.findAllInvoices();
  }

  async getUserInvoices(userId: string) {
    return this.invoiceRepository.findInvoicesByUserId(userId);
  }

  async getInvoiceByOrder(orderId: string, requester?: RequesterContext) {
    this.assertRequester(requester);

    const order = await this.invoiceRepository.findOrderForInvoice(orderId);
    if (!order) {
      throw new AppError(404, "Order not found");
    }

    this.assertOrderAccess(order.userId, requester);

    return this.ensureInvoiceForOrder(orderId, { sendEmails: false });
  }

  async downloadInvoiceByOrder(orderId: string, requester?: RequesterContext) {
    const invoice = await this.getInvoiceByOrder(orderId, requester);
    const content = await this.buildInvoicePdf(invoice);
    const orderReference = toOrderReference(invoice.orderId);

    return {
      invoiceNumber: invoice.invoiceNumber,
      filename: `${invoice.invoiceNumber}_${orderReference}.pdf`,
      content,
    };
  }

  async downloadInvoiceById(invoiceId: string, requester?: RequesterContext) {
    this.assertRequester(requester);

    const invoice = await this.invoiceRepository.findInvoiceById(invoiceId);
    if (!invoice) {
      throw new AppError(404, "Invoice not found");
    }

    this.assertOrderAccess(invoice.userId, requester);

    const content = await this.buildInvoicePdf(invoice);
    const orderReference = toOrderReference(invoice.orderId);

    return {
      invoiceNumber: invoice.invoiceNumber,
      filename: `${invoice.invoiceNumber}_${orderReference}.pdf`,
      content,
    };
  }
}
