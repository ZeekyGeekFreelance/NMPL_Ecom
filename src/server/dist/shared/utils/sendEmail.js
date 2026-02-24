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
const branding_1 = require("./branding");
const isDevelopment = process.env.NODE_ENV !== "production";
const debugLog = (...args) => {
    if (isDevelopment) {
        console.log(...args);
    }
};
const sendEmail = (_a) => __awaiter(void 0, [_a], void 0, function* ({ to, subject, text, html, cc, bcc, attachments, }) {
    try {
        const emailUser = process.env.EMAIL_USER;
        const emailPass = process.env.EMAIL_PASS;
        const platformName = (0, branding_1.getPlatformName)();
        if (!emailUser || !emailPass) {
            console.error("Email not sent: EMAIL_USER/EMAIL_PASS are not configured.");
            return false;
        }
        const transporter = nodemailer_1.default.createTransport({
            service: "gmail",
            auth: {
                user: emailUser,
                pass: emailPass,
            },
        });
        const mailOptions = {
            from: `"${platformName} Support" <${emailUser}>`,
            to,
            subject,
            text,
            html,
            cc,
            bcc,
            attachments,
        };
        const info = yield transporter.sendMail(mailOptions);
        debugLog("Email sent: ", info.response);
        return true;
    }
    catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
});
exports.default = sendEmail;
