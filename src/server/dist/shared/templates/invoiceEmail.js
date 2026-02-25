"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildInvoiceEmailTemplate = void 0;
const branding_1 = require("@/shared/utils/branding");
const dateTime_1 = require("@/shared/utils/dateTime");
const currency_1 = require("@/shared/utils/currency");
const buildInvoiceEmailTemplate = ({ recipientName, accountReference, copyLabel, invoiceNumber, orderId, customerType, orderDate, totalAmount, }) => {
    const normalizedName = (recipientName === null || recipientName === void 0 ? void 0 : recipientName.trim()) || "Customer";
    const amount = (0, currency_1.formatINRCurrency)(totalAmount);
    const placedOn = (0, dateTime_1.formatDateTimeInIST)(orderDate);
    const generatedAt = (0, dateTime_1.formatDateTimeInIST)(new Date());
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
            customerType ? `Customer Type: ${customerType}` : null,
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
          ${accountReference
            ? `<strong>Account Reference:</strong> ${accountReference}<br />`
            : ""}
          <strong>Invoice Number:</strong> ${invoiceNumber}<br />
          <strong>Order ID:</strong> ${orderId}<br />
          ${customerType ? `<strong>Customer Type:</strong> ${customerType}<br />` : ""}
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
exports.buildInvoiceEmailTemplate = buildInvoiceEmailTemplate;
