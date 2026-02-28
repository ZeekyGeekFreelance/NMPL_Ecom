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

    if (requester.role === "USER" && requester.id === ownerUserId) {
      return;
    }

    throw new AppError(403, "You are not authorized to access this invoice.");
  }

  private getInternalRecipients(customerEmail: string): string[] {
    const configuredRecipients = (process.env.BILLING_NOTIFICATION_EMAILS || "")
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);

    const fallback = process.env.EMAIL_USER?.trim()
      ? [process.env.EMAIL_USER.trim()]
      : [];

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

  private async sendInvoiceEmails(invoice: InvoiceWithDetails): Promise<void> {
    const internalRecipients = this.getInternalRecipients(invoice.customerEmail);
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
    options?: { sendEmails?: boolean }
  ): Promise<InvoiceWithDetails> {
    const order = await this.invoiceRepository.findOrderForInvoice(orderId);

    if (!order) {
      throw new AppError(404, "Order not found");
    }

    const transactionStatus = String(
      order.transaction?.status || order.status || ""
    )
      .trim()
      .toUpperCase();

    const normalizedStatusByLegacyValue: Record<string, string> = {
      PLACED: ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION,
      PENDING: ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION,
      PROCESSING: ORDER_LIFECYCLE_STATUS.CONFIRMED,
      SHIPPED: ORDER_LIFECYCLE_STATUS.CONFIRMED,
      IN_TRANSIT: ORDER_LIFECYCLE_STATUS.CONFIRMED,
      DELIVERED: ORDER_LIFECYCLE_STATUS.DELIVERED,
      REJECTED: ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
      CANCELED: ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
      RETURNED: ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
      REFUNDED: ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
    };

    const normalizedStatus =
      normalizedStatusByLegacyValue[transactionStatus] || transactionStatus;

    if (
      normalizedStatus !== ORDER_LIFECYCLE_STATUS.CONFIRMED &&
      normalizedStatus !== ORDER_LIFECYCLE_STATUS.DELIVERED
    ) {
      throw new AppError(
        409,
        "Invoice is available only after payment confirmation."
      );
    }

    const invoice =
      (await this.invoiceRepository.findInvoiceByOrderId(orderId)) ||
      (await this.invoiceRepository.ensureInvoiceRecord({
        orderId,
        userId: order.userId,
        customerEmail: order.user.email,
        year: new Date().getFullYear(),
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

    const customerType = this.resolveCustomerType(invoice);

    return generateInvoicePdf({
      invoiceNumber: invoice.invoiceNumber,
      orderId: toOrderReference(invoice.orderId),
      orderDate: invoice.order.orderDate,
      customerName: invoice.user.name,
      accountReference: toAccountReference(invoice.user.id),
      customerEmail: invoice.customerEmail,
      customerType,
      items,
      subtotalAmount: Number(invoice.order.subtotalAmount || 0),
      deliveryCharge: Number(invoice.order.deliveryCharge || 0),
      deliveryMode: String(invoice.order.deliveryMode || "DELIVERY"),
      totalAmount: invoice.order.amount,
      billingAddress: invoice.order.address
        ? {
            fullName: invoice.order.address.fullName,
            phoneNumber: invoice.order.address.phoneNumber,
            line1: invoice.order.address.line1,
            line2: invoice.order.address.line2,
            landmark: invoice.order.address.landmark,
            city: invoice.order.address.city,
            state: invoice.order.address.state,
            pincode: invoice.order.address.pincode,
            country: invoice.order.address.country,
          }
        : null,
    });
  }

  async generateAndSendInvoiceForOrder(orderId: string): Promise<InvoiceWithDetails> {
    const invoice = await this.ensureInvoiceForOrder(orderId, {
      sendEmails: true,
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
