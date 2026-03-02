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

const createTransporter = (
  user: string,
  pass: string
): nodemailer.Transporter => {
  const smtpHost = config.email.smtpHost;
  if (smtpHost) {
    const port = config.email.smtpPort;
    const secure = config.email.smtpSecure;

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

  const service = config.email.emailService;
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


