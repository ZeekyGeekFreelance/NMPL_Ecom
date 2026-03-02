"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupportEmail = exports.getPlatformName = void 0;
const config_1 = require("@/config");
const getPlatformName = () => config_1.config.branding.platformName;
exports.getPlatformName = getPlatformName;
const getSupportEmail = () => {
    const billingNotificationEmail = config_1.config.branding.billingNotificationEmails
        .split(",")
        .map((email) => email.trim())
        .find(Boolean);
    return billingNotificationEmail || config_1.config.branding.supportEmail;
};
exports.getSupportEmail = getSupportEmail;
