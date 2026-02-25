import { getPlatformName, getSupportEmail } from "@/shared/utils/branding";
import { formatDateTimeInIST } from "@/shared/utils/dateTime";

interface InvoiceEmailTemplateInput {
  recipientName: string;
  accountReference?: string | null;
  copyLabel: string;
  invoiceNumber: string;
  orderId: string;
  orderDate: Date;
  totalAmount: number;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);

export const buildInvoiceEmailTemplate = ({
  recipientName,
  accountReference,
  copyLabel,
  invoiceNumber,
  orderId,
  orderDate,
  totalAmount,
}: InvoiceEmailTemplateInput): { html: string; text: string } => {
  const normalizedName = recipientName?.trim() || "Customer";
  const amount = formatCurrency(totalAmount);
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
      `Order Date: ${placedOn}`,
      `Generated At: ${generatedAt}`,
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
          <strong>Order Date:</strong> ${placedOn}<br />
          <strong>Generated At:</strong> ${generatedAt}<br />
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
