"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupportEmail = exports.getPlatformName = void 0;
const DEFAULT_PLATFORM_NAME = "W-PDMS";
const DEFAULT_SUPPORT_EMAIL = "support@example.com";
const firstNonEmpty = (values) => {
    for (const value of values) {
        const normalized = value === null || value === void 0 ? void 0 : value.trim();
        if (normalized) {
            return normalized;
        }
    }
    return null;
};
const getPlatformName = () => {
    return firstNonEmpty([process.env.PLATFORM_NAME]) || DEFAULT_PLATFORM_NAME;
};
exports.getPlatformName = getPlatformName;
const getSupportEmail = () => {
    var _a;
    const billingNotificationEmail = (_a = process.env.BILLING_NOTIFICATION_EMAILS) === null || _a === void 0 ? void 0 : _a.split(",").map((email) => email.trim()).find(Boolean);
    return (firstNonEmpty([
        process.env.SUPPORT_EMAIL,
        billingNotificationEmail,
        process.env.EMAIL_USER,
    ]) || DEFAULT_SUPPORT_EMAIL);
};
exports.getSupportEmail = getSupportEmail;
