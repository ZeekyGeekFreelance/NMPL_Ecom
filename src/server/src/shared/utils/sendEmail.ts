import nodemailer from "nodemailer";
import logger from "@/infra/winston/logger";
import { getPlatformName } from "./branding";
import { config } from "@/config";

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

const resolveCredentials = (): { user: string; pass: string } => {
  const user = config.email.smtpUser;
  const pass = config.email.smtpPass;
  return { user, pass };
};

// Singleton transporter — reuses the same SMTP connection pool across all emails.
// Re-created only if credentials change between calls (unlikely in practice).
let _transporter: nodemailer.Transporter | null = null;
let _transporterCacheKey = "";

const getTransporter = (user: string, pass: string): nodemailer.Transporter => {
  const cacheKey = `${user}:${pass}:${config.email.smtpHost}:${config.email.smtpPort}`;
  if (_transporter && _transporterCacheKey === cacheKey) {
    return _transporter;
  }

  const smtpHost = config.email.smtpHost;
  let transporter: nodemailer.Transporter;

  if (smtpHost) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: config.email.smtpPort,
      secure: config.email.smtpSecure,
      auth: { user, pass },
      pool: true,          // keep-alive connection pool
      maxConnections: 5,
      maxMessages: 100,
    });
  } else {
    transporter = nodemailer.createTransport({
      service: config.email.emailService,
      auth: { user, pass },
    });
  }

  _transporter = transporter;
  _transporterCacheKey = cacheKey;
  return transporter;
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

    const transporter = getTransporter(emailUser, emailPass);
    const fromAddress = config.email.from;
    const fromName = config.email.fromName || `${platformName} Support`;

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


