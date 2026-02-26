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
const nodemailer_1 = __importDefault(require("nodemailer"));
const logger_1 = __importDefault(require("@/infra/winston/logger"));
const branding_1 = require("./branding");
const parsePort = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const parseSecureFlag = (value, fallback) => {
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
const resolveCredentials = () => {
    const user = (process.env.SMTP_USER || process.env.EMAIL_USER || "").trim();
    const pass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || "").trim();
    return { user, pass };
};
const createTransporter = (user, pass) => {
    var _a, _b;
    const smtpHost = (_a = process.env.SMTP_HOST) === null || _a === void 0 ? void 0 : _a.trim();
    if (smtpHost) {
        const port = parsePort(process.env.SMTP_PORT, 587);
        const secure = parseSecureFlag(process.env.SMTP_SECURE, port === 465);
        return nodemailer_1.default.createTransport({
            host: smtpHost,
            port,
            secure,
            auth: {
                user,
                pass,
            },
        });
    }
    const service = ((_b = process.env.EMAIL_SERVICE) === null || _b === void 0 ? void 0 : _b.trim()) || "gmail";
    return nodemailer_1.default.createTransport({
        service,
        auth: {
            user,
            pass,
        },
    });
};
const sendEmail = (_a) => __awaiter(void 0, [_a], void 0, function* ({ to, subject, text, html, cc, bcc, attachments, }) {
    try {
        const { user: emailUser, pass: emailPass } = resolveCredentials();
        const platformName = (0, branding_1.getPlatformName)();
        if (!emailUser || !emailPass) {
            logger_1.default.error("[sendEmail] Email not sent: SMTP_USER/SMTP_PASS or EMAIL_USER/EMAIL_PASS are not configured.");
            return false;
        }
        const transporter = createTransporter(emailUser, emailPass);
        const fromAddress = (process.env.EMAIL_FROM || emailUser).trim();
        const fromName = (process.env.EMAIL_FROM_NAME || `${platformName} Support`).trim();
        const mailOptions = {
            from: `"${fromName}" <${fromAddress}>`,
            to,
            subject,
            text,
            html,
            cc,
            bcc,
            attachments,
        };
        yield transporter.sendMail(mailOptions);
        return true;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.default.error(`[sendEmail] Error sending email: ${message}`);
        return false;
    }
});
exports.default = sendEmail;
