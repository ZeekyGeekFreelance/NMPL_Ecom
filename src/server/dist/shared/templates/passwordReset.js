"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const branding_1 = require("@/shared/utils/branding");
const passwordResetTemplate = (resetUrl, options = {}) => {
    var _a, _b, _c;
    const platformName = ((_a = options.platformName) === null || _a === void 0 ? void 0 : _a.trim()) || (0, branding_1.getPlatformName)();
    const supportEmail = ((_b = options.supportEmail) === null || _b === void 0 ? void 0 : _b.trim()) || (0, branding_1.getSupportEmail)();
    const expiresInMinutes = (_c = options.expiresInMinutes) !== null && _c !== void 0 ? _c : 10;
    return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${platformName} Password Reset</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
            <tr>
              <td style="padding:28px;">
                <h2 style="margin:0 0 12px;font-size:22px;color:#111827;">${platformName} Password Reset</h2>
                <p style="margin:0 0 12px;">We received a request to reset your password for <strong>${platformName}</strong>.</p>
                <p style="margin:0 0 16px;">Use the secure button below. This link expires in <strong>${expiresInMinutes} minutes</strong>.</p>
                <p style="margin:0 0 20px;">
                  <a
                    href="${resetUrl}"
                    style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 18px;border-radius:8px;"
                  >Reset Password</a>
                </p>
                <p style="margin:0 0 10px;">If you did not request this, you can safely ignore this email.</p>
                <p style="margin:0;color:#6b7280;font-size:13px;">
                  Need help? Contact
                  <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 28px;background:#f9fafb;color:#6b7280;font-size:12px;">
                This is an automated security message from ${platformName}.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
};
exports.default = passwordResetTemplate;
