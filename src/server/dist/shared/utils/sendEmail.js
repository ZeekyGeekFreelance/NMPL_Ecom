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
const config_1 = require("@/config");
const resolveCredentials = () => {
    const user = config_1.config.email.smtpUser;
    const pass = config_1.config.email.smtpPass;
    return { user, pass };
};
const createTransporter = (user, pass) => {
    const smtpHost = config_1.config.email.smtpHost;
    if (smtpHost) {
        const port = config_1.config.email.smtpPort;
        const secure = config_1.config.email.smtpSecure;
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
    const service = config_1.config.email.emailService;
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
        const fromAddress = config_1.config.email.from;
        const fromName = config_1.config.email.fromName || `${platformName} Support`;
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
