import nodemailer from "nodemailer";
import { getPlatformName } from "./branding";

const isDevelopment = process.env.NODE_ENV !== "production";
const debugLog = (...args: unknown[]) => {
  if (isDevelopment) {
    console.log(...args);
  }
};

// Define the type for email options
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

// Define the type for transporter configuration
interface TransporterConfig {
  service: string;
  auth: {
    user: string;
    pass: string;
  };
}

// Define the type for mail options
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
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const platformName = getPlatformName();

    if (!emailUser || !emailPass) {
      console.error("Email not sent: EMAIL_USER/EMAIL_PASS are not configured.");
      return false;
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    } as TransporterConfig);

    const mailOptions: MailOptions = {
      from: `"${platformName} Support" <${emailUser}>`,
      to,
      subject,
      text,
      html,
      cc,
      bcc,
      attachments,
    };

    const info = await transporter.sendMail(mailOptions);
    debugLog("Email sent: ", info.response);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
};

export default sendEmail;


