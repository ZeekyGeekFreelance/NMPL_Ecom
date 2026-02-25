import { getPlatformName } from "@/shared/utils/branding";
import { formatINRCurrency } from "@/shared/utils/currency";

export type DealerStatusEmail = "PENDING" | "APPROVED" | "REJECTED";

export interface DealerPricingChangeRow {
  sku: string;
  productName: string;
  previousPrice: number | null;
  nextPrice: number | null;
}

const formatCurrency = (value: number) => formatINRCurrency(value);

const formatOptionalCurrency = (value: number | null) => {
  if (value === null) {
    return "Base price";
  }
  return formatCurrency(value);
};

const platformName = getPlatformName();

const withPlatformSubject = (subject: string) =>
  `${platformName} | ${subject}`;

const baseEmailLayout = ({
  preview,
  title,
  bodyHtml,
}: {
  preview: string;
  title: string;
  bodyHtml: string;
}) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preview}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#f9fafb;color:#6b7280;font-size:12px;">
                This is an automated message from ${platformName}.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

const statusMeta: Record<
  DealerStatusEmail,
  { title: string; copy: string; subject: string }
> = {
  PENDING: {
    subject: withPlatformSubject("Dealer Application In Review"),
    title: "Application In Review",
    copy: "Your dealer application is currently in review by our admin team.",
  },
  APPROVED: {
    subject: withPlatformSubject("Dealer Application Approved"),
    title: "Application Approved",
    copy: "Your dealer account is now approved and ready to use.",
  },
  REJECTED: {
    subject: withPlatformSubject("Dealer Application Update"),
    title: "Application Update",
    copy: "Your dealer application has been reviewed and is currently marked as rejected.",
  },
};

export const buildDealerApplicationSubmittedEmail = ({
  recipientName,
  businessName,
  accountReference,
  portalUrl,
  supportEmail,
  wasResubmission = false,
}: {
  recipientName: string;
  businessName: string | null;
  accountReference?: string | null;
  portalUrl: string;
  supportEmail: string;
  wasResubmission?: boolean;
}) => {
  const salutation = recipientName?.trim() || "Dealer";
  const businessLine = businessName
    ? `Business: <strong>${businessName}</strong><br />`
    : "";
  const title = wasResubmission
    ? "Dealer Application Resubmitted"
    : "Dealer Application Received";
  const summary = wasResubmission
    ? "Your dealer application has been resubmitted successfully."
    : "Your dealer application has been received successfully.";

  return {
    subject: withPlatformSubject(title),
    text: [
      `Hello ${salutation},`,
      "",
      `This is an update from ${platformName}.`,
      "",
      summary,
      businessName ? `Business: ${businessName}` : null,
      accountReference ? `Account Reference: ${accountReference}` : null,
      "Status: PENDING REVIEW",
      `Portal: ${portalUrl}`,
      `Support: ${supportEmail}`,
    ]
      .filter(Boolean)
      .join("\n"),
    html: baseEmailLayout({
      preview: summary,
      title,
      bodyHtml: `
        <h2 style="margin:0 0 12px;font-size:22px;color:#111827;">${title}</h2>
        <p style="margin:0 0 14px;">Hello <strong>${salutation}</strong>,</p>
        <p style="margin:0 0 14px;">${summary}</p>
        <p style="margin:0 0 14px;">
          ${businessLine}
          ${accountReference ? `Account Reference: <strong>${accountReference}</strong><br />` : ""}
          Status: <strong>PENDING REVIEW</strong>
        </p>
        <p style="margin:0 0 10px;">You can sign in after an admin approves your request.</p>
        <p style="margin:0;">
          Portal: <a href="${portalUrl}" style="color:#2563eb;">${portalUrl}</a><br />
          Support: <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>
        </p>
      `,
    }),
  };
};

export const buildDealerStatusUpdatedEmail = ({
  recipientName,
  businessName,
  accountReference,
  status,
  reviewedBy,
  portalUrl,
  supportEmail,
}: {
  recipientName: string;
  businessName: string | null;
  accountReference?: string | null;
  status: DealerStatusEmail;
  reviewedBy: string;
  portalUrl: string;
  supportEmail: string;
}) => {
  const salutation = recipientName?.trim() || "Dealer";
  const meta = statusMeta[status];
  const businessLine = businessName ? `Business: ${businessName}` : null;

  return {
    subject: meta.subject,
    text: [
      `Hello ${salutation},`,
      "",
      `This is an update from ${platformName}.`,
      "",
      meta.copy,
      `Status: ${status}`,
      businessLine,
      accountReference ? `Account Reference: ${accountReference}` : null,
      `Reviewed by: ${reviewedBy}`,
      `Portal: ${portalUrl}`,
      `Support: ${supportEmail}`,
    ]
      .filter(Boolean)
      .join("\n"),
    html: baseEmailLayout({
      preview: meta.copy,
      title: meta.subject,
      bodyHtml: `
        <h2 style="margin:0 0 12px;font-size:22px;color:#111827;">${meta.title}</h2>
        <p style="margin:0 0 14px;">Hello <strong>${salutation}</strong>,</p>
        <p style="margin:0 0 14px;">${meta.copy}</p>
        <p style="margin:0 0 14px;">
          <strong>Status:</strong> ${status}<br />
          ${businessName ? `<strong>Business:</strong> ${businessName}<br />` : ""}
          ${accountReference ? `<strong>Account Reference:</strong> ${accountReference}<br />` : ""}
          <strong>Reviewed by:</strong> ${reviewedBy}
        </p>
        <p style="margin:0;">
          Portal: <a href="${portalUrl}" style="color:#2563eb;">${portalUrl}</a><br />
          Support: <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>
        </p>
      `,
    }),
  };
};

export const buildDealerPricingUpdatedEmail = ({
  recipientName,
  businessName,
  accountReference,
  updatedBy,
  changeCount,
  totalMappedVariants,
  changes,
  portalUrl,
  supportEmail,
}: {
  recipientName: string;
  businessName: string | null;
  accountReference?: string | null;
  updatedBy: string;
  changeCount: number;
  totalMappedVariants: number;
  changes: DealerPricingChangeRow[];
  portalUrl: string;
  supportEmail: string;
}) => {
  const salutation = recipientName?.trim() || "Dealer";
  const visibleRows = changes.slice(0, 12);
  const hasMore = changes.length > visibleRows.length;

  const tableRowsHtml = visibleRows
    .map(
      (row) => `
        <tr>
          <td style="padding:8px;border:1px solid #e5e7eb;">${row.productName}</td>
          <td style="padding:8px;border:1px solid #e5e7eb;">${row.sku}</td>
          <td style="padding:8px;border:1px solid #e5e7eb;">${formatOptionalCurrency(
            row.previousPrice
          )}</td>
          <td style="padding:8px;border:1px solid #e5e7eb;">${formatOptionalCurrency(
            row.nextPrice
          )}</td>
        </tr>
      `
    )
    .join("");

  return {
    subject: withPlatformSubject("Dealer Pricing Updated"),
    text: [
      `Hello ${salutation},`,
      "",
      `This is an update from ${platformName}.`,
      "",
      "Your dealer pricing has been updated by admin.",
      businessName ? `Business: ${businessName}` : null,
      accountReference ? `Account Reference: ${accountReference}` : null,
      `Updated by: ${updatedBy}`,
      `Changed variants: ${changeCount}`,
      `Total mapped variants: ${totalMappedVariants}`,
      "",
      "Recent changes:",
      ...visibleRows.map(
        (row) =>
          `- ${row.productName} (${row.sku}): ${formatOptionalCurrency(
            row.previousPrice
          )} -> ${formatOptionalCurrency(row.nextPrice)}`
      ),
      hasMore ? `...and ${changes.length - visibleRows.length} more changes.` : null,
      "",
      `Portal: ${portalUrl}`,
      `Support: ${supportEmail}`,
    ]
      .filter(Boolean)
      .join("\n"),
    html: baseEmailLayout({
      preview: "Your dealer pricing has been updated.",
      title: withPlatformSubject("Dealer Pricing Updated"),
      bodyHtml: `
        <h2 style="margin:0 0 12px;font-size:22px;color:#111827;">Dealer Pricing Updated</h2>
        <p style="margin:0 0 14px;">Hello <strong>${salutation}</strong>,</p>
        <p style="margin:0 0 14px;">Your pricing configuration has been updated by admin.</p>
        <p style="margin:0 0 14px;">
          ${businessName ? `<strong>Business:</strong> ${businessName}<br />` : ""}
          ${accountReference ? `<strong>Account Reference:</strong> ${accountReference}<br />` : ""}
          <strong>Updated by:</strong> ${updatedBy}<br />
          <strong>Changed variants:</strong> ${changeCount}<br />
          <strong>Total mapped variants:</strong> ${totalMappedVariants}
        </p>
        ${
          visibleRows.length
            ? `
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:8px 0 14px;">
                <thead>
                  <tr style="background:#f3f4f6;">
                    <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Product</th>
                    <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">SKU</th>
                    <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Previous</th>
                    <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Updated</th>
                  </tr>
                </thead>
                <tbody>${tableRowsHtml}</tbody>
              </table>
            `
            : ""
        }
        ${
          hasMore
            ? `<p style="margin:0 0 12px;color:#6b7280;">...and ${
                changes.length - visibleRows.length
              } more changes.</p>`
            : ""
        }
        <p style="margin:0;">
          Portal: <a href="${portalUrl}" style="color:#2563eb;">${portalUrl}</a><br />
          Support: <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>
        </p>
      `,
    }),
  };
};

export const buildDealerAccountCreatedEmail = ({
  recipientName,
  businessName,
  accountReference,
  email,
  temporaryPassword,
  portalUrl,
  supportEmail,
}: {
  recipientName: string;
  businessName: string | null;
  accountReference?: string | null;
  email: string;
  temporaryPassword: string;
  portalUrl: string;
  supportEmail: string;
}) => {
  const salutation = recipientName?.trim() || "Dealer";

  return {
    subject: withPlatformSubject("Your Dealer Account Is Ready"),
    text: [
      `Hello ${salutation},`,
      "",
      `This is an update from ${platformName}.`,
      "",
      "An admin created and approved your dealer account.",
      businessName ? `Business: ${businessName}` : null,
      accountReference ? `Account Reference: ${accountReference}` : null,
      `Email: ${email}`,
      `Temporary password: ${temporaryPassword}`,
      `Sign in: ${portalUrl}/dealer/sign-in`,
      "For security, reset your password after first login.",
      `Support: ${supportEmail}`,
    ]
      .filter(Boolean)
      .join("\n"),
    html: baseEmailLayout({
      preview: "Your dealer account is approved and ready to use.",
      title: "Dealer Account Ready",
      bodyHtml: `
        <h2 style="margin:0 0 12px;font-size:22px;color:#111827;">Dealer Account Ready</h2>
        <p style="margin:0 0 14px;">Hello <strong>${salutation}</strong>,</p>
        <p style="margin:0 0 14px;">An admin created and approved your dealer account.</p>
        <p style="margin:0 0 14px;">
          ${businessName ? `<strong>Business:</strong> ${businessName}<br />` : ""}
          ${accountReference ? `<strong>Account Reference:</strong> ${accountReference}<br />` : ""}
          <strong>Email:</strong> ${email}<br />
          <strong>Temporary password:</strong> ${temporaryPassword}
        </p>
        <p style="margin:0 0 14px;">
          Sign in: <a href="${portalUrl}/dealer/sign-in" style="color:#2563eb;">${portalUrl}/dealer/sign-in</a><br />
          For security, please reset your password after first login.
        </p>
        <p style="margin:0;">
          Support: <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>
        </p>
      `,
    }),
  };
};

export const buildDealerRemovedEmail = ({
  recipientName,
  businessName,
  accountReference,
  removedBy,
  supportEmail,
}: {
  recipientName: string;
  businessName: string | null;
  accountReference?: string | null;
  removedBy: string;
  supportEmail: string;
}) => {
  const salutation = recipientName?.trim() || "Dealer";

  return {
    subject: withPlatformSubject("Dealership Access Removed"),
    text: [
      `Hello ${salutation},`,
      "",
      `This is an update from ${platformName}.`,
      "",
      "Your dealership access has been removed by admin.",
      businessName ? `Business: ${businessName}` : null,
      accountReference ? `Account Reference: ${accountReference}` : null,
      `Updated by: ${removedBy}`,
      `Support: ${supportEmail}`,
    ]
      .filter(Boolean)
      .join("\n"),
    html: baseEmailLayout({
      preview: "Your dealership access has been removed.",
      title: "Dealership Access Removed",
      bodyHtml: `
        <h2 style="margin:0 0 12px;font-size:22px;color:#111827;">Dealership Access Removed</h2>
        <p style="margin:0 0 14px;">Hello <strong>${salutation}</strong>,</p>
        <p style="margin:0 0 14px;">Your dealership access has been removed by admin.</p>
        <p style="margin:0 0 14px;">
          ${businessName ? `<strong>Business:</strong> ${businessName}<br />` : ""}
          ${accountReference ? `<strong>Account Reference:</strong> ${accountReference}<br />` : ""}
          <strong>Updated by:</strong> ${removedBy}
        </p>
        <p style="margin:0;">
          For clarification, contact support at
          <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>.
        </p>
      `,
    }),
  };
};
