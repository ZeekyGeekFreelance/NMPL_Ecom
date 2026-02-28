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
  deliveryCharge?: number;
  deliveryMode?: string;
  totalAmount: number;
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
  deliveryCharge,
  deliveryMode,
  totalAmount,
}: InvoiceEmailTemplateInput): { html: string; text: string } => {
  const normalizedName = recipientName?.trim() || "Customer";
  const amount = formatINRCurrency(totalAmount);
  const subtotal =
    typeof subtotalAmount === "number" ? formatINRCurrency(subtotalAmount) : null;
  const delivery =
    typeof deliveryCharge === "number" ? formatINRCurrency(deliveryCharge) : null;
  const placedOn = formatDateTimeInIST(orderDate);
  const generatedAt = formatDateTimeInIST(new Date());
  const platformName = getPlatformName();
  const supportEmail = getSupportEmail();
  const billingTeamLabel = `${platformName} Billing Team`;

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
      delivery ? `Delivery (${deliveryMode || "DELIVERY"}): ${delivery}` : null,
      `Total Amount: ${amount}`,
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
            delivery
              ? `<strong>Delivery (${deliveryMode || "DELIVERY"}):</strong> ${delivery}<br />`
              : ""
          }
          <strong>Total Amount:</strong> ${amount}
        </p>
        <p>
          Support:
          <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>
        </p>
        <p>Thanks,<br />${billingTeamLabel}</p>
      </div>
    `,
  };
};
