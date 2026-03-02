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
exports.DealerNotificationService = void 0;
const logger_1 = __importDefault(require("@/infra/winston/logger"));
const dealerNotifications_1 = require("@/shared/templates/dealerNotifications");
const branding_1 = require("@/shared/utils/branding");
const sendEmail_1 = __importDefault(require("@/shared/utils/sendEmail"));
const config_1 = require("@/config");
class DealerNotificationService {
    getPortalUrl() {
        const clientUrl = config_1.config.isProduction
            ? config_1.config.urls.clientProd
            : config_1.config.urls.clientDev;
        return clientUrl.replace(/\/+$/, "");
    }
    getSupportEmail() {
        return (0, branding_1.getSupportEmail)();
    }
    sendNotification(payload, context) {
        return __awaiter(this, void 0, void 0, function* () {
            const sent = yield (0, sendEmail_1.default)(payload);
            if (!sent) {
                logger_1.default.warn(`[DealerNotificationService] Failed to send "${context}" email to ${payload.to}`);
            }
        });
    }
    sendDealerApplicationSubmitted(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const { subject, text, html } = (0, dealerNotifications_1.buildDealerApplicationSubmittedEmail)({
                recipientName: params.recipientName,
                businessName: params.businessName,
                accountReference: (_a = params.accountReference) !== null && _a !== void 0 ? _a : null,
                portalUrl: this.getPortalUrl(),
                supportEmail: this.getSupportEmail(),
                wasResubmission: (_b = params.wasResubmission) !== null && _b !== void 0 ? _b : false,
            });
            yield this.sendNotification({
                to: params.recipientEmail,
                subject,
                text,
                html,
            }, params.wasResubmission
                ? "dealer_application_resubmitted"
                : "dealer_application_submitted");
        });
    }
    sendDealerStatusUpdated(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { subject, text, html } = (0, dealerNotifications_1.buildDealerStatusUpdatedEmail)({
                recipientName: params.recipientName,
                businessName: params.businessName,
                accountReference: (_a = params.accountReference) !== null && _a !== void 0 ? _a : null,
                status: params.status,
                reviewedBy: params.reviewedBy,
                portalUrl: this.getPortalUrl(),
                supportEmail: this.getSupportEmail(),
            });
            yield this.sendNotification({
                to: params.recipientEmail,
                subject,
                text,
                html,
            }, `dealer_status_${params.status.toLowerCase()}`);
        });
    }
    sendDealerPricingUpdated(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { subject, text, html } = (0, dealerNotifications_1.buildDealerPricingUpdatedEmail)({
                recipientName: params.recipientName,
                businessName: params.businessName,
                accountReference: (_a = params.accountReference) !== null && _a !== void 0 ? _a : null,
                updatedBy: params.updatedBy,
                changeCount: params.changeCount,
                totalMappedVariants: params.totalMappedVariants,
                changes: params.changes,
                portalUrl: this.getPortalUrl(),
                supportEmail: this.getSupportEmail(),
            });
            yield this.sendNotification({
                to: params.recipientEmail,
                subject,
                text,
                html,
            }, "dealer_pricing_updated");
        });
    }
    sendDealerAccountCreated(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { subject, text, html } = (0, dealerNotifications_1.buildDealerAccountCreatedEmail)({
                recipientName: params.recipientName,
                businessName: params.businessName,
                accountReference: (_a = params.accountReference) !== null && _a !== void 0 ? _a : null,
                email: params.recipientEmail,
                temporaryPassword: params.temporaryPassword,
                portalUrl: this.getPortalUrl(),
                supportEmail: this.getSupportEmail(),
            });
            yield this.sendNotification({
                to: params.recipientEmail,
                subject,
                text,
                html,
            }, "dealer_account_created");
        });
    }
    sendDealerRemoved(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { subject, text, html } = (0, dealerNotifications_1.buildDealerRemovedEmail)({
                recipientName: params.recipientName,
                businessName: params.businessName,
                accountReference: (_a = params.accountReference) !== null && _a !== void 0 ? _a : null,
                removedBy: params.removedBy,
                supportEmail: this.getSupportEmail(),
            });
            yield this.sendNotification({
                to: params.recipientEmail,
                subject,
                text,
                html,
            }, "dealer_removed");
        });
    }
}
exports.DealerNotificationService = DealerNotificationService;
