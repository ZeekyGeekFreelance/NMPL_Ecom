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
        const configuredRecipients = (process.env.BILLING_NOTIFICATION_EMAILS || "")
            .split(",")
            .map((email) => email.trim())
            .filter(Boolean);
        const fallback = ((_a = process.env.EMAIL_USER) === null || _a === void 0 ? void 0 : _a.trim())
            ? [process.env.EMAIL_USER.trim()]
            : [];
        const recipients = configuredRecipients.length > 0 ? configuredRecipients : fallback;
        const customerEmailLower = customerEmail.toLowerCase();
        return Array.from(new Set(recipients.filter((email) => email.toLowerCase() !== customerEmailLower)));
    }
    getCustomerCopyLabel(invoice) {
        var _a;
        const isDealer = ((_a = invoice.user.dealerProfile) === null || _a === void 0 ? void 0 : _a.status) === "APPROVED";
        return isDealer ? "Dealer Copy" : "Client Copy";
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
            const platformName = (0, branding_1.getPlatformName)();
            const accountReference = (0, accountReference_1.toAccountReference)(invoice.user.id);
            let customerEmailSent = !shouldSendCustomerCopy;
            let internalEmailSent = !shouldSendInternalCopy;
            const errors = [];
            if (shouldSendCustomerCopy) {
                const customerTemplate = (0, invoiceEmail_1.buildInvoiceEmailTemplate)({
                    recipientName: invoice.user.name,
                    accountReference,
                    copyLabel,
                    invoiceNumber: invoice.invoiceNumber,
                    orderId: invoice.orderId,
                    orderDate: invoice.order.orderDate,
                    totalAmount: invoice.order.amount,
                });
                customerEmailSent = yield (0, sendEmail_1.default)({
                    to: invoice.customerEmail,
                    subject: `${platformName} | ${invoice.invoiceNumber} | ${copyLabel}`,
                    text: customerTemplate.text,
                    html: customerTemplate.html,
                    attachments: [
                        {
                            filename: `${invoice.invoiceNumber}.pdf`,
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
                    orderId: invoice.orderId,
                    orderDate: invoice.order.orderDate,
                    totalAmount: invoice.order.amount,
                });
                const internalResults = yield Promise.all(internalRecipients.map((recipient) => (0, sendEmail_1.default)({
                    to: recipient,
                    subject: `${platformName} | ${invoice.invoiceNumber} | Billing Copy`,
                    text: internalTemplate.text,
                    html: internalTemplate.html,
                    attachments: [
                        {
                            filename: `${invoice.invoiceNumber}.pdf`,
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
            const transactionStatus = (((_a = order.transaction) === null || _a === void 0 ? void 0 : _a.status) || order.status || "")
                .toString()
                .toUpperCase();
            const normalizedStatusByLegacyValue = {
                PENDING: "PLACED",
                PROCESSING: "CONFIRMED",
                SHIPPED: "CONFIRMED",
                IN_TRANSIT: "CONFIRMED",
                CANCELED: "REJECTED",
                RETURNED: "REJECTED",
                REFUNDED: "REJECTED",
            };
            const normalizedStatus = normalizedStatusByLegacyValue[transactionStatus] || transactionStatus;
            if (!["CONFIRMED", "DELIVERED"].includes(normalizedStatus)) {
                throw new AppError_1.default(409, "Invoice is available only after admin confirms the order.");
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
            const customerType = ((_a = invoice.user.dealerProfile) === null || _a === void 0 ? void 0 : _a.status) === "APPROVED" ? "DEALER" : "CLIENT";
            return (0, generateInvoicePdf_1.default)({
                invoiceNumber: invoice.invoiceNumber,
                orderId: invoice.orderId,
                orderDate: invoice.order.orderDate,
                customerName: invoice.user.name,
                accountReference: (0, accountReference_1.toAccountReference)(invoice.user.id),
                customerEmail: invoice.customerEmail,
                customerType,
                items,
                totalAmount: invoice.order.amount,
                billingAddress: invoice.order.address
                    ? {
                        street: invoice.order.address.street,
                        city: invoice.order.address.city,
                        state: invoice.order.address.state,
                        zip: invoice.order.address.zip,
                        country: invoice.order.address.country,
                    }
                    : null,
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
            return {
                invoiceNumber: invoice.invoiceNumber,
                filename: `${invoice.invoiceNumber}.pdf`,
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
            return {
                invoiceNumber: invoice.invoiceNumber,
                filename: `${invoice.invoiceNumber}.pdf`,
                content,
            };
        });
    }
}
exports.InvoiceService = InvoiceService;
