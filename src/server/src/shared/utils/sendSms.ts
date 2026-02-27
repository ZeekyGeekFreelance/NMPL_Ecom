import axios from "axios";
import logger from "@/infra/winston/logger";

interface SendSmsInput {
  to: string;
  body: string;
}

const resolveSmsProvider = (): "TWILIO" | "LOG" => {
  const configuredProvider = (process.env.SMS_PROVIDER || "").trim().toUpperCase();
  if (configuredProvider === "LOG") {
    return "LOG";
  }

  if (configuredProvider === "TWILIO") {
    return "TWILIO";
  }

  return process.env.NODE_ENV === "production" ? "TWILIO" : "LOG";
};

const sendViaTwilio = async ({ to, body }: SendSmsInput): Promise<boolean> => {
  const accountSid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN || "").trim();
  const fromNumber = (process.env.TWILIO_FROM_NUMBER || "").trim();

  if (!accountSid || !authToken || !fromNumber) {
    logger.error(
      "[sendSms] SMS not sent: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_FROM_NUMBER is missing."
    );
    return false;
  }

  const payload = new URLSearchParams({
    From: fromNumber,
    To: to.trim(),
    Body: body,
  });

  try {
    await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      payload,
      {
        auth: {
          username: accountSid,
          password: authToken,
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[sendSms] Twilio SMS send failed: ${message}`);
    return false;
  }
};

const sendSms = async ({ to, body }: SendSmsInput): Promise<boolean> => {
  const provider = resolveSmsProvider();

  if (provider === "LOG") {
    logger.warn(`[sendSms] SMS_PROVIDER=LOG. OTP for ${to}: ${body}`);
    return true;
  }

  return sendViaTwilio({ to, body });
};

export default sendSms;
