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
exports.InvoiceService = void 0;
const AppError_1 = __importDefault(require("@/shared/errors/AppError"));
const sendEmail_1 = __importDefault(require("@/shared/utils/sendEmail"));
const logs_factory_1 = require("@/modules/logs/logs.factory");
const invoiceEmail_1 = require("@/shared/templates/invoiceEmail");
const generateInvoicePdf_1 = __importDefault(require("@/shared/utils/invoice/generateInvoicePdf"));
const branding_1 = require("@/shared/utils/branding");
const accountReference_1 = require("@/shared/utils/accountReference");
const userRole_1 = require("@/shared/utils/userRole");
const orderLifecycle_1 = require("@/shared/utils/orderLifecycle");
const checkoutPricing_1 = require("@/shared/utils/pricing/checkoutPricing");
const config_1 = require("@/config");
class InvoiceService {
    constructor(invoiceRepository) {
        this.invoiceRepository = invoiceRepository;
        this.logsService = (0, logs_factory_1.makeLogsService)();
    }
    isInvoiceTableMissing(error) {
        if (!(error instanceof Error)) {
            return false;
        }
        return (error.message.includes('relation "Invoice" does not exist') ||
            error.message.includes('relation "InvoiceCounter" does not exist'));
    }
    isAdminRole(role) {
        return role === "ADMIN" || role === "SUPERADMIN";
    }
    assertRequester(requester) {
        if (!(requester === null || requester === void 0 ? void 0 : requester.id) || !(requester === null || requester === void 0 ? void 0 : requester.role)) {
            throw new AppError_1.default(401, "Unauthorized request");
        }
    }
    assertOrderAccess(ownerUserId, requester) {
        if (this.isAdminRole(requester.role)) {
            return;
        }
        if (requester.role === "USER" && requester.id === ownerUserId) {
            return;
        }
        throw new AppError_1.default(403, "You are not authorized to access this invoice.");
    }
    getInternalRecipients(customerEmail) {
        var _a;
        const configuredRecipients = config_1.config.branding.billingNotificationEmails
            .split(",")
            .map((email) => email.trim())
            .filter(Boolean);
        const fallback = ((_a = config_1.config.email.smtpUser) === null || _a === void 0 ? void 0 : _a.trim()) ? [config_1.config.email.smtpUser.trim()] : [];
        const recipients = configuredRecipients.length > 0 ? configuredRecipients : fallback;
        const customerEmailLower = customerEmail.toLowerCase();
        return Array.from(new Set(recipients.filter((email) => email.toLowerCase() !== customerEmailLower)));
    }
    getCustomerCopyLabel(invoice) {
        return this.resolveCustomerType(invoice) === "DEALER"
            ? "Dealer Copy"
            : "User Copy";
    }
    resolveCustomerType(invoice) {
        if (invoice.order.customerRoleSnapshot === "DEALER") {
            return "DEALER";
        }
        if (invoice.order.customerRoleSnapshot === "USER") {
            return "USER";
        }
        return (0, userRole_1.resolveCustomerTypeFromUser)(invoice.user);
    }
    sendInvoiceEmails(invoice) {
        return __awaiter(this, void 0, void 0, function* () {
            const internalRecipients = this.getInternalRecipients(invoice.customerEmail);
            const shouldSendCustomerCopy = !invoice.customerEmailSentAt;
            const shouldSendInternalCopy = internalRecipients.length > 0 && !invoice.internalEmailSentAt;
            if (!shouldSendCustomerCopy && !shouldSendInternalCopy) {
                return;
            }
            const pdfBuffer = yield this.buildInvoicePdf(invoice);
            const copyLabel = this.getCustomerCopyLabel(invoice);
            const customerType = this.resolveCustomerType(invoice);
            const platformName = (0, branding_1.getPlatformName)();
            const accountReference = (0, accountReference_1.toAccountReference)(invoice.user.id);
            const orderReference = (0, accountReference_1.toOrderReference)(invoice.orderId);
            const invoiceAttachmentName = `${invoice.invoiceNumber}_${orderReference}.pdf`;
            let customerEmailSent = !shouldSendCustomerCopy;
            let internalEmailSent = !shouldSendInternalCopy;
            const errors = [];
            if (shouldSendCustomerCopy) {
                const customerTemplate = (0, invoiceEmail_1.buildInvoiceEmailTemplate)({
                    recipientName: invoice.user.name,
                    accountReference,
                    copyLabel,
                    invoiceNumber: invoice.invoiceNumber,
                    orderId: orderReference,
                    customerType,
                    orderDate: invoice.order.orderDate,
                    subtotalAmount: Number(invoice.order.subtotalAmount || 0),
                    deliveryCharge: Number(invoice.order.deliveryCharge || 0),
                    deliveryMode: String(invoice.order.deliveryMode || "DELIVERY"),
                    totalAmount: invoice.order.amount,
                });
                customerEmailSent = yield (0, sendEmail_1.default)({
                    to: invoice.customerEmail,
                    subject: `${platformName} | ${invoice.invoiceNumber} | ${copyLabel}`,
                    text: customerTemplate.text,
                    html: customerTemplate.html,
                    attachments: [
                        {
                            filename: invoiceAttachmentName,
                            content: pdfBuffer,
                            contentType: "application/pdf",
                        },
                    ],
                });
                if (!customerEmailSent) {
                    errors.push("Failed to send customer invoice email.");
                }
            }
            if (shouldSendInternalCopy && internalRecipients.length > 0) {
                const internalTemplate = (0, invoiceEmail_1.buildInvoiceEmailTemplate)({
                    recipientName: "Billing Team",
                    accountReference,
                    copyLabel: "Billing Copy",
                    invoiceNumber: invoice.invoiceNumber,
                    orderId: orderReference,
                    customerType,
                    orderDate: invoice.order.orderDate,
                    subtotalAmount: Number(invoice.order.subtotalAmount || 0),
                    deliveryCharge: Number(invoice.order.deliveryCharge || 0),
                    deliveryMode: String(invoice.order.deliveryMode || "DELIVERY"),
                    totalAmount: invoice.order.amount,
                });
                const internalResults = yield Promise.all(internalRecipients.map((recipient) => (0, sendEmail_1.default)({
                    to: recipient,
                    subject: `${platformName} | ${invoice.invoiceNumber} | Billing Copy`,
                    text: internalTemplate.text,
                    html: internalTemplate.html,
                    attachments: [
                        {
                            filename: invoiceAttachmentName,
                            content: pdfBuffer,
                            contentType: "application/pdf",
                        },
                    ],
                })));
                internalEmailSent = internalResults.every(Boolean);
                if (!internalEmailSent) {
                    errors.push("Failed to send internal billing invoice email.");
                }
            }
            yield this.invoiceRepository.updateInvoiceEmailStatus(invoice.id, {
                customerEmailSentAt: customerEmailSent
                    ? new Date()
                    : invoice.customerEmailSentAt,
                internalEmailSentAt: internalEmailSent
                    ? new Date()
                    : invoice.internalEmailSentAt,
                lastEmailError: errors.length ? errors.join(" ") : null,
            });
        });
    }
    ensureInvoiceForOrder(orderId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const order = yield this.invoiceRepository.findOrderForInvoice(orderId);
            if (!order) {
                throw new AppError_1.default(404, "Order not found");
            }
            const transactionStatus = String(((_a = order.transaction) === null || _a === void 0 ? void 0 : _a.status) || order.status || "")
                .trim()
                .toUpperCase();
            const normalizedStatusByLegacyValue = {
                PLACED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION,
                PENDING: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION,
                PROCESSING: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.CONFIRMED,
                SHIPPED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.CONFIRMED,
                IN_TRANSIT: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.CONFIRMED,
                DELIVERED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.DELIVERED,
                REJECTED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
                CANCELED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
                RETURNED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
                REFUNDED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
            };
            const normalizedStatus = normalizedStatusByLegacyValue[transactionStatus] || transactionStatus;
            if (normalizedStatus !== orderLifecycle_1.ORDER_LIFECYCLE_STATUS.CONFIRMED &&
                normalizedStatus !== orderLifecycle_1.ORDER_LIFECYCLE_STATUS.DELIVERED) {
                throw new AppError_1.default(409, "Invoice is available only after payment confirmation.");
            }
            const invoice = (yield this.invoiceRepository.findInvoiceByOrderId(orderId)) ||
                (yield this.invoiceRepository.ensureInvoiceRecord({
                    orderId,
                    userId: order.userId,
                    customerEmail: order.user.email,
                    year: new Date().getFullYear(),
                }));
            if ((options === null || options === void 0 ? void 0 : options.sendEmails) !== false) {
                yield this.sendInvoiceEmails(invoice);
            }
            return invoice;
        });
    }
    buildInvoicePdf(invoice) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const items = invoice.order.orderItems.map((item) => ({
                productName: item.variant.product.name,
                sku: item.variant.sku,
                quantity: item.quantity,
                unitPrice: item.price,
                subtotal: item.price * item.quantity,
            }));
            const customerType = this.resolveCustomerType(invoice);
            const normalizedDeliveryMode = String(invoice.order.deliveryMode || "DELIVERY")
                .trim()
                .toUpperCase();
            const isPickup = normalizedDeliveryMode === "PICKUP";
            const snapshotAddress = invoice.order.address;
            const pickupLocation = isPickup ? (0, checkoutPricing_1.getPickupLocationSnapshot)() : null;
            const locationAddress = snapshotAddress
                ? {
                    fullName: snapshotAddress.fullName,
                    phoneNumber: snapshotAddress.phoneNumber,
                    line1: snapshotAddress.line1,
                    line2: snapshotAddress.line2,
                    landmark: snapshotAddress.landmark,
                    city: snapshotAddress.city,
                    state: snapshotAddress.state,
                    pincode: snapshotAddress.pincode,
                    country: snapshotAddress.country,
                }
                : isPickup
                    ? {
                        // Legacy compatibility only: modern orders always snapshot pickup address.
                        fullName: pickupLocation === null || pickupLocation === void 0 ? void 0 : pickupLocation.fullName,
                        phoneNumber: pickupLocation === null || pickupLocation === void 0 ? void 0 : pickupLocation.phoneNumber,
                        line1: (pickupLocation === null || pickupLocation === void 0 ? void 0 : pickupLocation.line1) || "",
                        line2: (pickupLocation === null || pickupLocation === void 0 ? void 0 : pickupLocation.line2) || null,
                        landmark: (pickupLocation === null || pickupLocation === void 0 ? void 0 : pickupLocation.landmark) || null,
                        city: (pickupLocation === null || pickupLocation === void 0 ? void 0 : pickupLocation.city) || "",
                        state: (pickupLocation === null || pickupLocation === void 0 ? void 0 : pickupLocation.state) || "",
                        pincode: (pickupLocation === null || pickupLocation === void 0 ? void 0 : pickupLocation.pincode) || "",
                        country: (pickupLocation === null || pickupLocation === void 0 ? void 0 : pickupLocation.country) || "",
                    }
                    : null;
            return (0, generateInvoicePdf_1.default)({
                invoiceNumber: invoice.invoiceNumber,
                orderId: (0, accountReference_1.toOrderReference)(invoice.orderId),
                orderDate: invoice.order.orderDate,
                customerName: invoice.user.name,
                customerPhone: invoice.user.phone || ((_a = invoice.order.address) === null || _a === void 0 ? void 0 : _a.phoneNumber) || null,
                accountReference: (0, accountReference_1.toAccountReference)(invoice.user.id),
                customerEmail: invoice.customerEmail,
                customerType,
                items,
                subtotalAmount: Number(invoice.order.subtotalAmount || 0),
                deliveryCharge: Number(invoice.order.deliveryCharge || 0),
                deliveryMode: normalizedDeliveryMode,
                totalAmount: invoice.order.amount,
                locationLabel: isPickup ? "Pickup Location" : "Delivery To",
                locationAddress,
            });
        });
    }
    generateAndSendInvoiceForOrder(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const invoice = yield this.ensureInvoiceForOrder(orderId, {
                sendEmails: true,
            });
            yield this.logsService.info("Invoice generated successfully", {
                orderId,
                invoiceNumber: invoice.invoiceNumber,
                customerEmail: invoice.customerEmail,
            });
            return invoice;
        });
    }
    getAllInvoices() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.invoiceRepository.findAllInvoices();
        });
    }
    getUserInvoices(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.invoiceRepository.findInvoicesByUserId(userId);
        });
    }
    getInvoiceByOrder(orderId, requester) {
        return __awaiter(this, void 0, void 0, function* () {
            this.assertRequester(requester);
            const order = yield this.invoiceRepository.findOrderForInvoice(orderId);
            if (!order) {
                throw new AppError_1.default(404, "Order not found");
            }
            this.assertOrderAccess(order.userId, requester);
            return this.ensureInvoiceForOrder(orderId, { sendEmails: false });
        });
    }
    downloadInvoiceByOrder(orderId, requester) {
        return __awaiter(this, void 0, void 0, function* () {
            const invoice = yield this.getInvoiceByOrder(orderId, requester);
            const content = yield this.buildInvoicePdf(invoice);
            const orderReference = (0, accountReference_1.toOrderReference)(invoice.orderId);
            return {
                invoiceNumber: invoice.invoiceNumber,
                filename: `${invoice.invoiceNumber}_${orderReference}.pdf`,
                content,
            };
        });
    }
    downloadInvoiceById(invoiceId, requester) {
        return __awaiter(this, void 0, void 0, function* () {
            this.assertRequester(requester);
            const invoice = yield this.invoiceRepository.findInvoiceById(invoiceId);
            if (!invoice) {
                throw new AppError_1.default(404, "Invoice not found");
            }
            this.assertOrderAccess(invoice.userId, requester);
            const content = yield this.buildInvoicePdf(invoice);
            const orderReference = (0, accountReference_1.toOrderReference)(invoice.orderId);
            return {
                invoiceNumber: invoice.invoiceNumber,
                filename: `${invoice.invoiceNumber}_${orderReference}.pdf`,
                content,
            };
        });
    }
}
exports.InvoiceService = InvoiceService;
