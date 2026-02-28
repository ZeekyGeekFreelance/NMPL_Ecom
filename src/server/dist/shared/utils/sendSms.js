"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const logger_1 = __importDefault(require("@/infra/winston/logger"));
const resolveSmsProvider = () => {
    const configuredProvider = (process.env.SMS_PROVIDER || "").trim().toUpperCase();
    if (configuredProvider === "LOG") {
        return "LOG";
    }
    if (configuredProvider === "TWILIO") {
        return "TWILIO";
    }
    return process.env.NODE_ENV === "production" ? "TWILIO" : "LOG";
};
const sendViaTwilio = (_a) => __awaiter(void 0, [_a], void 0, function* ({ to, body }) {
    const accountSid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
    const authToken = (process.env.TWILIO_AUTH_TOKEN || "").trim();
    const fromNumber = (process.env.TWILIO_FROM_NUMBER || "").trim();
    if (!accountSid || !authToken || !fromNumber) {
        logger_1.default.error("[sendSms] SMS not sent: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_FROM_NUMBER is missing.");
        return false;
    }
    const payload = new URLSearchParams({
        From: fromNumber,
        To: to.trim(),
        Body: body,
    });
    try {
        yield axios_1.default.post(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, payload, {
            auth: {
                username: accountSid,
                password: authToken,
            },
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });
        return true;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.default.error(`[sendSms] Twilio SMS send failed: ${message}`);
        return false;
    }
});
const sendSms = (_a) => __awaiter(void 0, [_a], void 0, function* ({ to, body }) {
    const provider = resolveSmsProvider();
    if (provider === "LOG") {
        logger_1.default.warn(`[sendSms] SMS_PROVIDER=LOG. OTP for ${to}: ${body}`);
        return true;
    }
    return sendViaTwilio({ to, body });
});
exports.default = sendSms;
