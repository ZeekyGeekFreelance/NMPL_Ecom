import nodemailer from "nodemailer";
import logger from "@/infra/winston/logger";
import { getPlatformName } from "./branding";

interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: EmailAttachment[];
}

interface MailOptions {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: EmailAttachment[];
}

const parsePort = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseSecureFlag = (
  value: string | undefined,
  fallback: boolean
): boolean => {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }

  if (normalized === "false" || normalized === "0") {
    return false;
  }

  return fallback;
};

const resolveCredentials = (): { user: string; pass: string } => {
  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || "").trim();
  const pass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || "").trim();
  return { user, pass };
};

const createTransporter = (
  user: string,
  pass: string
): nodemailer.Transporter => {
  const smtpHost = process.env.SMTP_HOST?.trim();
  if (smtpHost) {
    const port = parsePort(process.env.SMTP_PORT, 587);
    const secure = parseSecureFlag(process.env.SMTP_SECURE, port === 465);

    return nodemailer.createTransport({
      host: smtpHost,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
  }

  const service = process.env.EMAIL_SERVICE?.trim() || "gmail";
  return nodemailer.createTransport({
    service,
    auth: {
      user,
      pass,
    },
  });
};

const sendEmail = async ({
  to,
  subject,
  text,
  html,
  cc,
  bcc,
  attachments,
}: EmailOptions): Promise<boolean> => {
  try {
    const { user: emailUser, pass: emailPass } = resolveCredentials();
    const platformName = getPlatformName();

    if (!emailUser || !emailPass) {
      logger.error(
        "[sendEmail] Email not sent: SMTP_USER/SMTP_PASS or EMAIL_USER/EMAIL_PASS are not configured."
      );
      return false;
    }

    const transporter = createTransporter(emailUser, emailPass);
    const fromAddress = (process.env.EMAIL_FROM || emailUser).trim();
    const fromName = (process.env.EMAIL_FROM_NAME || `${platformName} Support`).trim();

    const mailOptions: MailOptions = {
      from: `"${fromName}" <${fromAddress}>`,
      to,
      subject,
      text,
      html,
      cc,
      bcc,
      attachments,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[sendEmail] Error sending email: ${message}`);
    return false;
  }
};

export default sendEmail;


