"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildInvoiceEmailTemplate = void 0;
const branding_1 = require("@/shared/utils/branding");
const formatCurrency = (amount) => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
}).format(amount);
const formatDate = (date) => new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
}).format(date);
const buildInvoiceEmailTemplate = ({ recipientName, accountReference, copyLabel, invoiceNumber, orderId, orderDate, totalAmount, }) => {
    const normalizedName = (recipientName === null || recipientName === void 0 ? void 0 : recipientName.trim()) || "Customer";
    const amount = formatCurrency(totalAmount);
    const placedOn = formatDate(orderDate);
    const platformName = (0, branding_1.getPlatformName)();
    const supportEmail = (0, branding_1.getSupportEmail)();
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
          ${accountReference
            ? `<strong>Account Reference:</strong> ${accountReference}<br />`
            : ""}
          <strong>Invoice Number:</strong> ${invoiceNumber}<br />
          <strong>Order ID:</strong> ${orderId}<br />
          <strong>Order Date:</strong> ${placedOn}<br />
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
exports.buildInvoiceEmailTemplate = buildInvoiceEmailTemplate;
