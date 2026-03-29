import { getPlatformName, getSupportEmail } from "@/shared/utils/branding";
import { formatDateTimeInIST } from "@/shared/utils/dateTime";
import { formatINRCurrency } from "@/shared/utils/currency";

interface InvoiceEmailTemplateInput {
  recipientName: string;
  accountReference?: string | null;
  copyLabel: string;
  invoiceNumber: string;
  orderId: string;
  customerType?: "USER" | "DEALER";
  orderDate: Date;
  subtotalAmount?: number;
  taxAmount?: number;
  deliveryCharge?: number;
  deliveryMode?: string;
  totalAmount: number;
  /** PAID | PAYMENT_DUE | OVERDUE — drives the payment-status block in the email */
  paymentStatus?: string | null;
  /** e.g. "NET 30 DAYS" — shown in the payment-due block */
  paymentTerms?: string | null;
  /** Due date for pay-later invoices */
  paymentDueDate?: Date | null;
}

export const buildInvoiceEmailTemplate = ({
  recipientName,
  accountReference,
  copyLabel,
  invoiceNumber,
  orderId,
  customerType,
  orderDate,
  subtotalAmount,
  taxAmount,
  deliveryCharge,
  deliveryMode,
  totalAmount,
  paymentStatus,
  paymentTerms,
  paymentDueDate,
}: InvoiceEmailTemplateInput): { html: string; text: string } => {
  const normalizedName = recipientName?.trim() || "Customer";
  const amount = formatINRCurrency(totalAmount);
  const subtotal =
    typeof subtotalAmount === "number" ? formatINRCurrency(subtotalAmount) : null;
  const tax =
    typeof taxAmount === "number" ? formatINRCurrency(taxAmount) : null;
  const delivery =
    typeof deliveryCharge === "number" ? formatINRCurrency(deliveryCharge) : null;
  const placedOn = formatDateTimeInIST(orderDate);
  const generatedAt = formatDateTimeInIST(new Date());
  const platformName = getPlatformName();
  const supportEmail = getSupportEmail();
  const billingTeamLabel = `${platformName} Billing Team`;

  const isPaymentDue = paymentStatus === "PAYMENT_DUE" || paymentStatus === "OVERDUE";
  const isOverdue = paymentStatus === "OVERDUE";
  const dueDateFormatted = paymentDueDate ? formatDateTimeInIST(paymentDueDate) : null;

  return {
    text: [
      `Hello ${normalizedName},`,
      "",
      `${copyLabel} from ${platformName} for your order is attached.`,
      accountReference ? `Account Reference: ${accountReference}` : null,
      `Invoice Number: ${invoiceNumber}`,
      `Order ID: ${orderId}`,
      customerType ? `Customer Type: ${customerType}` : null,
      `Order Date: ${placedOn}`,
      `Generated At: ${generatedAt}`,
      subtotal ? `Subtotal: ${subtotal}` : null,
      tax ? `GST: ${tax}` : null,
      delivery ? `Delivery (${deliveryMode || "DELIVERY"}): ${delivery}` : null,
      `Total Amount: ${amount}`,
      isPaymentDue ? `Payment Status: ${isOverdue ? "OVERDUE" : "PAYMENT DUE"}` : null,
      paymentTerms ? `Payment Terms: ${paymentTerms}` : null,
      dueDateFormatted ? `Payment Due Date: ${dueDateFormatted}` : null,
      `Support: ${supportEmail}`,
      "",
      "Thanks,",
      billingTeamLabel,
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
        <p>Hello ${normalizedName},</p>
        <p><strong>${copyLabel}</strong> from <strong>${platformName}</strong> for your order is attached.</p>
        <p>
          ${
            accountReference
              ? `<strong>Account Reference:</strong> ${accountReference}<br />`
              : ""
          }
          <strong>Invoice Number:</strong> ${invoiceNumber}<br />
          <strong>Order ID:</strong> ${orderId}<br />
          ${customerType ? `<strong>Customer Type:</strong> ${customerType}<br />` : ""}
          <strong>Order Date:</strong> ${placedOn}<br />
          <strong>Generated At:</strong> ${generatedAt}<br />
          ${
            subtotal
              ? `<strong>Subtotal:</strong> ${subtotal}<br />`
              : ""
          }
          ${
            tax
              ? `<strong>GST:</strong> ${tax}<br />`
              : ""
          }
          ${
            delivery
              ? `<strong>Delivery (${deliveryMode || "DELIVERY"}):</strong> ${delivery}<br />`
              : ""
          }
          <strong>Total Amount:</strong> ${amount}
        </p>
        ${
          isPaymentDue
            ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="background:${isOverdue ? "#fef2f2" : "#fefce8"};border:1px solid ${isOverdue ? "#fecaca" : "#fde68a"};border-radius:6px;margin:12px 0;">
          <tr>
            <td style="padding:14px 18px;">
              <p style="margin:0 0 6px;font-weight:bold;color:${isOverdue ? "#b91c1c" : "#92400e"};"
              >${isOverdue ? "&#9888; PAYMENT OVERDUE" : "&#9432; PAYMENT DUE"}</p>
              ${paymentTerms ? `<p style="margin:0 0 4px;"><strong>Terms:</strong> ${paymentTerms}</p>` : ""}
              ${dueDateFormatted ? `<p style="margin:0;"><strong>Due Date:</strong> ${dueDateFormatted}</p>` : ""}
            </td>
          </tr>
        </table>`
            : ""
        }
        <p>
          Support:
          <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>
        </p>
        <p>Thanks,<br />${billingTeamLabel}</p>
      </div>
    `,
  };
};
