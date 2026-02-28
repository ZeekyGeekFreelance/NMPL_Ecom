"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const buildRegistrationOtpTemplate = ({ platformName, emailOtpCode, purposeLabel, expiresInMinutes, supportEmail, }) => {
    const subject = `${platformName} | Email Verification OTP`;
    const text = [
        `Use this email OTP to continue ${purposeLabel} on ${platformName}.`,
        `Email OTP: ${emailOtpCode}`,
        `This OTP expires in ${expiresInMinutes} minutes.`,
        "Do not share this OTP with anyone.",
        `If you did not request this, contact ${supportEmail}.`,
    ].join("\n");
    const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6; max-width: 560px;">
      <h2 style="margin: 0 0 12px;">Verify Your Email</h2>
      <p style="margin: 0 0 12px;">
        Use this email OTP to continue your <strong>${purposeLabel}</strong> on <strong>${platformName}</strong>.
      </p>
      <div style="margin: 16px 0; padding: 16px; background: #f3f4f6; border-radius: 8px; text-align: center;">
        <p style="margin: 0 0 8px; font-size: 13px; color: #374151;">Email OTP</p>
        <span style="font-size: 28px; letter-spacing: 6px; font-weight: 700;">${emailOtpCode}</span>
      </div>
      <p style="margin: 0 0 12px;">This OTP expires in <strong>${expiresInMinutes} minutes</strong>.</p>
      <p style="margin: 0;">
        Do not share this OTP with anyone. If this request was not initiated by you, contact
        <a href="mailto:${supportEmail}" style="color: #2563eb;">${supportEmail}</a>.
      </p>
    </div>
  `;
    return { subject, text, html };
};
exports.default = buildRegistrationOtpTemplate;
