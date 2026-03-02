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
exports.TransactionService = void 0;
const AppError_1 = __importDefault(require("@/shared/errors/AppError"));
const invoice_factory_1 = require("../invoice/invoice.factory");
const logs_factory_1 = require("../logs/logs.factory");
const accountReference_1 = require("@/shared/utils/accountReference");
const sendEmail_1 = __importDefault(require("@/shared/utils/sendEmail"));
const branding_1 = require("@/shared/utils/branding");
const database_config_1 = __importDefault(require("@/infra/database/database.config"));
const client_1 = require("@prisma/client");
const dateTime_1 = require("@/shared/utils/dateTime");
const userRole_1 = require("@/shared/utils/userRole");
const orderLifecycle_1 = require("@/shared/utils/orderLifecycle");
const config_1 = require("@/config");
const userFacingStatusLabel = {
    PENDING_VERIFICATION: "Pending Verification",
    WAITLISTED: "Waitlisted",
    AWAITING_PAYMENT: "Awaiting Payment",
    QUOTATION_REJECTED: "Quotation Rejected",
    QUOTATION_EXPIRED: "Quotation Expired",
    CONFIRMED: "Confirmed",
    DELIVERED: "Delivered",
};
const statusEmailSubjectLine = {
    PENDING_VERIFICATION: "Order Received - Verification Pending",
    WAITLISTED: "Order Waitlisted",
    AWAITING_PAYMENT: "Quotation Approved - Payment Required",
    QUOTATION_REJECTED: "Quotation Rejected",
    QUOTATION_EXPIRED: "Quotation Expired",
    CONFIRMED: "Order Confirmed",
    DELIVERED: "Order Delivered",
};
const statusInstruction = {
    PENDING_VERIFICATION: "Stock will be verified by our team before quotation approval.",
    WAITLISTED: "This order is currently waitlisted because stock is fully reserved.",
    AWAITING_PAYMENT: "Your quotation is approved and stock is reserved. Complete payment before reservation expiry.",
    QUOTATION_REJECTED: "The quotation has been rejected and any reserved stock has been released.",
    QUOTATION_EXPIRED: "The quotation expired before payment and reserved stock has been released.",
    CONFIRMED: "Payment has been received and your order is now confirmed.",
    DELIVERED: "Order has been marked as delivered.",
};
class TransactionService {
    constructor(transactionRepository) {
        this.transactionRepository = transactionRepository;
        this.logsService = (0, logs_factory_1.makeLogsService)();
        this.invoiceService = (0, invoice_factory_1.makeInvoiceService)();
    }
    resolveTransactionId(identifier) {
        return __awaiter(this, void 0, void 0, function* () {
            const normalized = String(identifier || "").trim();
            if (!normalized) {
                throw new AppError_1.default(400, "Transaction ID is required");
            }
            if (!normalized.toUpperCase().startsWith("TXN-")) {
                return normalized;
            }
            const transactionId = yield this.transactionRepository.findIdByReference(normalized);
            if (!transactionId) {
                throw new AppError_1.default(404, "Transaction not found");
            }
            return transactionId;
        });
    }
    parseStatus(value) {
        const normalized = value.trim().toUpperCase();
        const compact = normalized.replace(/[^A-Z]/g, "");
        const statusAliasMap = {
            PENDINGVERIFICATION: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION,
            VERIFY: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION,
            PLACED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION,
            PENDING: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION,
            WAITLISTED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.WAITLISTED,
            WAITLIST: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.WAITLISTED,
            AWAITINGPAYMENT: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT,
            QUOTATIONAPPROVED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT,
            APPROVED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT,
            QUOTATIONREJECTED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
            REJECTED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
            CANCELED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
            CANCELLED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
            REFUNDED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
            RETURNED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
            QUOTATIONEXPIRED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_EXPIRED,
            EXPIRED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_EXPIRED,
            CONFIRMED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.CONFIRMED,
            PAID: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.CONFIRMED,
            DELIVERED: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.DELIVERED,
        };
        const mapped = statusAliasMap[compact] || statusAliasMap[normalized];
        if (mapped) {
            return mapped;
        }
        throw new AppError_1.default(400, `Invalid status value: ${value}`);
    }
    assertValidStatusTransition(currentStatus, nextStatus) {
        if (currentStatus === nextStatus) {
            return;
        }
        const allowed = orderLifecycle_1.ORDER_STATUS_TRANSITIONS[currentStatus] || [];
        if (!allowed.includes(nextStatus)) {
            throw new AppError_1.default(400, `Invalid status transition from ${currentStatus} to ${nextStatus}`);
        }
    }
    resolvePortalUrl() {
        const configuredUrl = config_1.config.isProduction
            ? config_1.config.urls.clientProd
            : config_1.config.urls.clientDev;
        return configuredUrl.replace(/\/+$/, "");
    }
    formatCurrency(value) {
        const amount = Number(value);
        const safeAmount = Number.isFinite(amount) ? amount : 0;
        return `INR ${safeAmount.toFixed(2)}`;
    }
    normalizeQuotationLogLineItems(rawLineItems) {
        if (!Array.isArray(rawLineItems)) {
            return [];
        }
        return rawLineItems.map((entry) => {
            const row = entry && typeof entry === "object"
                ? entry
                : {};
            const quantity = Number(row.quantity);
            const unitPrice = Number(row.unitPrice);
            const explicitLineTotal = Number(row.lineTotal);
            const safeQuantity = Number.isFinite(quantity) ? quantity : 0;
            const safeUnitPrice = Number.isFinite(unitPrice) ? unitPrice : 0;
            const safeLineTotal = Number.isFinite(explicitLineTotal)
                ? explicitLineTotal
                : safeQuantity * safeUnitPrice;
            return {
                productName: String(row.productName || "Product").trim() || "Product",
                sku: String(row.sku || "N/A").trim() || "N/A",
                quantity: safeQuantity,
                unitPrice: safeUnitPrice,
                lineTotal: Number(safeLineTotal.toFixed(2)),
            };
        });
    }
    notifyQuotationIssued(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const customerEmail = (_a = params.recipientEmail) === null || _a === void 0 ? void 0 : _a.trim();
            if (!customerEmail) {
                return;
            }
            const platformName = (0, branding_1.getPlatformName)();
            const supportEmail = (0, branding_1.getSupportEmail)();
            const portalUrl = this.resolvePortalUrl();
            const orderReference = (0, accountReference_1.toOrderReference)(params.orderId);
            const orderUrl = `${portalUrl}/orders/${orderReference}`;
            const payActionUrl = `${orderUrl}?quotationAction=pay`;
            const rejectActionUrl = `${orderUrl}?quotationAction=reject`;
            const actionTime = (0, dateTime_1.formatDateTimeInIST)(new Date());
            const expiresAt = params.reservationExpiresAt
                ? (0, dateTime_1.formatDateTimeInIST)(new Date(params.reservationExpiresAt))
                : "Not available";
            const normalizeItems = (rows) => rows.map((row) => ({
                productName: row.productName || "Product",
                sku: row.sku || "N/A",
                quantity: Number(row.quantity) || 0,
                unitPrice: Number(row.unitPrice) || 0,
                lineTotal: Number(row.lineTotal) || 0,
            }));
            const revisedItems = normalizeItems(params.quotationItems || []);
            const originalItemsInput = Array.isArray(params.originalOrderItems) && params.originalOrderItems.length
                ? params.originalOrderItems
                : revisedItems;
            const originalItems = normalizeItems(originalItemsInput);
            const originalAmountValue = Number(params.originalOrderAmount);
            const originalTotal = Number.isFinite(originalAmountValue)
                ? originalAmountValue
                : originalItems.reduce((sum, item) => sum + item.lineTotal, 0);
            const quotedAmount = Number(params.quotedAmount) || 0;
            const toRowsText = (rows) => rows
                .map((item, index) => `${index + 1}. ${item.productName} (${item.sku}) - Qty: ${item.quantity}, Unit: ${this.formatCurrency(item.unitPrice)}, Line: ${this.formatCurrency(item.lineTotal)}`)
                .join("\n");
            const toRowsHtml = (rows) => rows
                .map((item, index) => `
            <tr>
              <td style="padding:8px;border:1px solid #e5e7eb;">${index + 1}</td>
              <td style="padding:8px;border:1px solid #e5e7eb;">${item.productName}</td>
              <td style="padding:8px;border:1px solid #e5e7eb;">${item.sku}</td>
              <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${item.quantity}</td>
              <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${this.formatCurrency(item.unitPrice)}</td>
              <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${this.formatCurrency(item.lineTotal)}</td>
            </tr>
          `)
                .join("");
            const originalRowsText = toRowsText(originalItems);
            const revisedRowsText = toRowsText(revisedItems);
            const originalRowsHtml = toRowsHtml(originalItems);
            const revisedRowsHtml = toRowsHtml(revisedItems);
            const emptyRowsHtml = `
      <tr>
        <td colspan="6" style="padding:10px;border:1px solid #e5e7eb;text-align:center;color:#6b7280;">
          No line items available.
        </td>
      </tr>
    `;
            const renderQuotationTable = (heading, rowsHtml, totalLabel, totalValue) => `
      <h3 style="margin:16px 0 8px 0;">${heading}</h3>
      <table style="border-collapse: collapse; width: 100%; margin: 0 0 12px 0;">
        <thead>
          <tr style="background-color:#f3f4f6;">
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">#</th>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Product</th>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">SKU</th>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:right;">Qty</th>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:right;">Unit Price</th>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:right;">Line Total</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || emptyRowsHtml}
        </tbody>
      </table>
      <p><strong>${totalLabel}:</strong> ${this.formatCurrency(totalValue)}</p>
    `;
            const originalSectionHtml = renderQuotationTable("Original Order (Placed)", originalRowsHtml, "Original Total", originalTotal);
            const revisedSectionHtml = renderQuotationTable("Revised Quotation", revisedRowsHtml, "Revised Total", quotedAmount);
            const sent = yield (0, sendEmail_1.default)({
                to: customerEmail,
                subject: `${platformName} | Revised Quotation Ready (${orderReference})`,
                text: [
                    `Hello ${((_b = params.recipientName) === null || _b === void 0 ? void 0 : _b.trim()) || "Customer"},`,
                    "",
                    `Your quotation is ready on ${platformName}.`,
                    `Order ID: ${orderReference}`,
                    `Account Reference: ${params.accountReference}`,
                    `Customer Type: ${params.customerType}`,
                    `Action Time (IST): ${actionTime}`,
                    `Reservation Expires (IST): ${expiresAt}`,
                    "",
                    "Original Order (Placed):",
                    originalRowsText || "No line items available.",
                    `Original Total: ${this.formatCurrency(originalTotal)}`,
                    "",
                    "Revised Quotation:",
                    revisedRowsText || "No line items available.",
                    `Revised Total: ${this.formatCurrency(quotedAmount)}`,
                    "",
                    `Proceed to payment: ${payActionUrl}`,
                    `Cancel quotation: ${rejectActionUrl}`,
                    "",
                    `Need help? Contact ${supportEmail}.`,
                ].join("\n"),
                html: `
        <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
          <p>Hello <strong>${((_c = params.recipientName) === null || _c === void 0 ? void 0 : _c.trim()) || "Customer"}</strong>,</p>
          <p>Your revised quotation is ready on <strong>${platformName}</strong>.</p>
          <p>
            <strong>Order ID:</strong> ${orderReference}<br />
            <strong>Account Reference:</strong> ${params.accountReference}<br />
            <strong>Customer Type:</strong> ${params.customerType}<br />
            <strong>Action Time (IST):</strong> ${actionTime}<br />
            <strong>Reservation Expires (IST):</strong> ${expiresAt}
          </p>
          ${originalSectionHtml}
          ${revisedSectionHtml}
          <p style="margin: 20px 0;">
            <a href="${payActionUrl}" style="display:inline-block;padding:10px 14px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;margin-right:10px;">Proceed to Payment</a>
            <a href="${rejectActionUrl}" style="display:inline-block;padding:10px 14px;background:#dc2626;color:#ffffff;text-decoration:none;border-radius:6px;">Cancel Quotation</a>
          </p>
          <p>
            Need help? Contact
            <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>.
          </p>
        </div>
      `,
            });
            if (!sent) {
                throw new Error("Quotation email failed to send.");
            }
        });
    }
    getAdminStatusCopyRecipients(excludeEmail) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const admins = yield database_config_1.default.user.findMany({
                where: {
                    role: {
                        in: [client_1.ROLE.ADMIN, client_1.ROLE.SUPERADMIN],
                    },
                },
                select: {
                    email: true,
                    name: true,
                    role: true,
                },
            });
            const normalizedExcludeEmail = excludeEmail === null || excludeEmail === void 0 ? void 0 : excludeEmail.trim().toLowerCase();
            const dedupe = new Set();
            const recipients = [];
            for (const admin of admins) {
                const normalizedEmail = (_a = admin.email) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase();
                if (!normalizedEmail) {
                    continue;
                }
                if (normalizedExcludeEmail &&
                    normalizedEmail === normalizedExcludeEmail) {
                    continue;
                }
                if (dedupe.has(normalizedEmail)) {
                    continue;
                }
                dedupe.add(normalizedEmail);
                recipients.push({
                    email: admin.email.trim(),
                    name: admin.name || "Admin",
                    role: admin.role,
                });
            }
            return recipients;
        });
    }
    notifyOrderStatusChange(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const platformName = (0, branding_1.getPlatformName)();
            const supportEmail = (0, branding_1.getSupportEmail)();
            const currentLabel = userFacingStatusLabel[params.nextStatus];
            const previousLabel = userFacingStatusLabel[params.previousStatus];
            const subjectLine = statusEmailSubjectLine[params.nextStatus];
            const customerName = ((_a = params.recipientName) === null || _a === void 0 ? void 0 : _a.trim()) || "Customer";
            const notificationPromises = [];
            const customerEmail = ((_b = params.recipientEmail) === null || _b === void 0 ? void 0 : _b.trim()) || null;
            const orderReference = (0, accountReference_1.toOrderReference)(params.orderId);
            const actionTime = (0, dateTime_1.formatDateTimeInIST)(new Date());
            const instruction = statusInstruction[params.nextStatus];
            if (customerEmail) {
                notificationPromises.push((0, sendEmail_1.default)({
                    to: customerEmail,
                    subject: `${platformName} | ${subjectLine}`,
                    text: [
                        `Hello ${customerName},`,
                        "",
                        `Your order has been updated on ${platformName}.`,
                        `Order ID: ${orderReference}`,
                        `Account Reference: ${params.accountReference}`,
                        `Previous status: ${previousLabel.toUpperCase()}`,
                        `Current status: ${currentLabel.toUpperCase()}`,
                        `Action Time (IST): ${actionTime}`,
                        instruction ? `Next step: ${instruction}` : null,
                        "",
                        `For support, contact ${supportEmail}.`,
                    ]
                        .filter(Boolean)
                        .join("\n"),
                    html: `
            <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
              <p>Hello <strong>${customerName}</strong>,</p>
              <p>Your order has been updated on <strong>${platformName}</strong>.</p>
              <p>
                <strong>Order ID:</strong> ${orderReference}<br />
                <strong>Account Reference:</strong> ${params.accountReference}<br />
                <strong>Previous status:</strong> ${previousLabel.toUpperCase()}<br />
                <strong>Current status:</strong> ${currentLabel.toUpperCase()}<br />
                <strong>Action Time (IST):</strong> ${actionTime}
              </p>
              ${instruction
                        ? `<p><strong>Next step:</strong> ${instruction}</p>`
                        : ""}
              <p>
                For support, contact
                <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>.
              </p>
            </div>
          `,
                }));
            }
            const roleCopyRecipients = yield this.getAdminStatusCopyRecipients(customerEmail);
            for (const recipient of roleCopyRecipients) {
                notificationPromises.push((0, sendEmail_1.default)({
                    to: recipient.email,
                    subject: `${platformName} | Order Status Updated (${currentLabel.toUpperCase()})`,
                    text: [
                        `Hello ${recipient.name},`,
                        "",
                        `An order status has been updated on ${platformName}.`,
                        `Order ID: ${orderReference}`,
                        `Customer: ${customerName}`,
                        `Customer Email: ${customerEmail || "Not available"}`,
                        `Customer Type: ${params.customerType}`,
                        `Account Reference: ${params.accountReference}`,
                        `Previous status: ${previousLabel.toUpperCase()}`,
                        `Current status: ${currentLabel.toUpperCase()}`,
                        `Action Time (IST): ${actionTime}`,
                        instruction ? `Next step: ${instruction}` : null,
                        "",
                        "This is an automated copy for operational tracking.",
                    ]
                        .filter(Boolean)
                        .join("\n"),
                    html: `
            <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
              <p>Hello <strong>${recipient.name}</strong>,</p>
              <p>An order status has been updated on <strong>${platformName}</strong>.</p>
              <p>
                <strong>Order ID:</strong> ${orderReference}<br />
                <strong>Customer:</strong> ${customerName}<br />
                <strong>Customer Email:</strong> ${customerEmail || "Not available"}<br />
                <strong>Customer Type:</strong> ${params.customerType}<br />
                <strong>Account Reference:</strong> ${params.accountReference}<br />
                <strong>Previous status:</strong> ${previousLabel.toUpperCase()}<br />
                <strong>Current status:</strong> ${currentLabel.toUpperCase()}<br />
                <strong>Action Time (IST):</strong> ${actionTime}
              </p>
              ${instruction
                        ? `<p><strong>Next step:</strong> ${instruction}</p>`
                        : ""}
              <p>This is an automated copy for operational tracking.</p>
            </div>
          `,
                }));
            }
            if (!notificationPromises.length) {
                return;
            }
            const results = yield Promise.allSettled(notificationPromises);
            const hasFailure = results.some((result) => result.status === "rejected" ||
                (result.status === "fulfilled" && result.value === false));
            if (hasFailure) {
                throw new Error("One or more order status notification emails failed.");
            }
        });
    }
    notifyPromotedWaitlistedOrders(orderIds) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!orderIds.length) {
                return;
            }
            const promotedTransactions = yield database_config_1.default.transaction.findMany({
                where: {
                    orderId: {
                        in: orderIds,
                    },
                },
                include: {
                    order: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    role: true,
                                    dealerProfile: {
                                        select: {
                                            status: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });
            for (const promoted of promotedTransactions) {
                const user = (_a = promoted.order) === null || _a === void 0 ? void 0 : _a.user;
                if (!user) {
                    continue;
                }
                yield this.notifyOrderStatusChange({
                    recipientEmail: user.email,
                    recipientName: user.name,
                    customerType: promoted.order.customerRoleSnapshot ||
                        (0, userRole_1.resolveCustomerTypeFromUser)(user),
                    accountReference: (0, accountReference_1.toAccountReference)(user.id),
                    orderId: promoted.orderId,
                    previousStatus: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.WAITLISTED,
                    nextStatus: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT,
                }).catch((error) => __awaiter(this, void 0, void 0, function* () {
                    const errorMessage = error instanceof Error ? error.message : "Unknown email error";
                    yield this.logsService.warn("Promoted waitlisted order email notification failed", {
                        orderId: promoted.orderId,
                        transactionId: promoted.id,
                        error: errorMessage,
                    });
                }));
            }
        });
    }
    processExpiredQuotations() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const expiredTransactionIds = yield this.transactionRepository.findExpiredAwaitingPaymentTransactionIds(new Date());
            for (const transactionId of expiredTransactionIds) {
                try {
                    const updated = yield this.transactionRepository.updateTransaction(transactionId, {
                        status: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_EXPIRED,
                        reservationExpiryHours: (0, orderLifecycle_1.getReservationExpiryHours)(),
                    });
                    const recipientEmail = ((_b = (_a = updated.transaction.order) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.email) || null;
                    const recipientName = ((_d = (_c = updated.transaction.order) === null || _c === void 0 ? void 0 : _c.user) === null || _d === void 0 ? void 0 : _d.name) || "Customer";
                    const recipientUserId = (_f = (_e = updated.transaction.order) === null || _e === void 0 ? void 0 : _e.user) === null || _f === void 0 ? void 0 : _f.id;
                    const customerType = ((_g = updated.transaction.order) === null || _g === void 0 ? void 0 : _g.customerRoleSnapshot) ||
                        (0, userRole_1.resolveCustomerTypeFromUser)((_h = updated.transaction.order) === null || _h === void 0 ? void 0 : _h.user);
                    const accountReference = recipientUserId
                        ? (0, accountReference_1.toAccountReference)(recipientUserId)
                        : "N/A";
                    yield this.notifyOrderStatusChange({
                        recipientEmail,
                        recipientName,
                        customerType,
                        accountReference,
                        orderId: updated.transaction.orderId,
                        previousStatus: updated.previousStatus,
                        nextStatus: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.QUOTATION_EXPIRED,
                    });
                    yield this.notifyPromotedWaitlistedOrders(updated.promotedOrderIds);
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : "Unknown expiry processing error";
                    yield this.logsService.error("Failed to expire overdue quotation", {
                        transactionId,
                        error: errorMessage,
                    });
                }
            }
            return expiredTransactionIds.length;
        });
    }
    getAllTransactions() {
        return __awaiter(this, arguments, void 0, function* (queryString = {}) {
            const hasExplicitPagination = queryString.page !== undefined || queryString.limit !== undefined;
            if (!hasExplicitPagination) {
                const transactions = yield this.transactionRepository.findMany();
                const totalResults = transactions.length;
                return {
                    transactions,
                    totalResults,
                    totalPages: totalResults > 0 ? 1 : 0,
                    currentPage: 1,
                    resultsPerPage: totalResults,
                };
            }
            const parsedPage = Number(queryString.page);
            const parsedLimit = Number(queryString.limit);
            const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;
            const resultsPerPage = Number.isFinite(parsedLimit) && parsedLimit > 0
                ? Math.floor(parsedLimit)
                : 16;
            const skip = (currentPage - 1) * resultsPerPage;
            const [transactions, totalResults] = yield Promise.all([
                this.transactionRepository.findMany({
                    skip,
                    take: resultsPerPage,
                }),
                this.transactionRepository.countTransactions(),
            ]);
            const totalPages = Math.ceil(totalResults / resultsPerPage);
            return {
                transactions,
                totalResults,
                totalPages,
                currentPage,
                resultsPerPage,
            };
        });
    }
    getTransactionById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const resolvedId = yield this.resolveTransactionId(id);
            const transaction = yield this.transactionRepository.findById(resolvedId);
            if (!transaction) {
                throw new AppError_1.default(404, "Transaction not found");
            }
            const userId = (_b = (_a = transaction.order) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id;
            if (!userId || !((_c = transaction.order) === null || _c === void 0 ? void 0 : _c.user)) {
                return transaction;
            }
            const customerType = transaction.order.customerRoleSnapshot ||
                (0, userRole_1.resolveCustomerTypeFromUser)(transaction.order.user);
            return Object.assign(Object.assign({}, transaction), { order: Object.assign(Object.assign({}, transaction.order), { customerType, user: Object.assign(Object.assign({}, transaction.order.user), { accountReference: (0, accountReference_1.toAccountReference)(userId), effectiveRole: (0, userRole_1.resolveEffectiveRoleFromUser)(transaction.order.user) }) }) });
        });
    }
    updateTransactionStatus(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
            const resolvedId = yield this.resolveTransactionId(id);
            const existingTransaction = yield this.transactionRepository.findById(resolvedId);
            if (!existingTransaction) {
                throw new AppError_1.default(404, "Transaction not found");
            }
            const previousStatus = this.parseStatus(String(existingTransaction.status));
            const requestedStatus = this.parseStatus(String(data.status));
            this.assertValidStatusTransition(previousStatus, requestedStatus);
            const actorRole = String(data.actorRole || "")
                .trim()
                .toUpperCase();
            const isAdminActor = actorRole === "ADMIN" || actorRole === "SUPERADMIN";
            const hasQuotationItems = Array.isArray(data.quotationItems) && data.quotationItems.length > 0;
            if (requestedStatus === orderLifecycle_1.ORDER_LIFECYCLE_STATUS.CONFIRMED &&
                isAdminActor) {
                throw new AppError_1.default(400, "Manual payment confirmation is disabled. Order is auto-confirmed after successful payment.");
            }
            if (hasQuotationItems) {
                if (requestedStatus !== orderLifecycle_1.ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT) {
                    throw new AppError_1.default(400, "Quotation updates can only be issued with AWAITING_PAYMENT status.");
                }
                const canIssueQuotationFromStatus = previousStatus === orderLifecycle_1.ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION ||
                    previousStatus === orderLifecycle_1.ORDER_LIFECYCLE_STATUS.WAITLISTED;
                if (!canIssueQuotationFromStatus) {
                    throw new AppError_1.default(400, `Quotation can be issued only from PENDING_VERIFICATION or WAITLISTED. Current status: ${previousStatus}`);
                }
            }
            if (previousStatus === requestedStatus && !hasQuotationItems) {
                return existingTransaction;
            }
            const updateResult = yield this.transactionRepository.updateTransaction(resolvedId, Object.assign({ status: requestedStatus, reservationExpiryHours: (0, orderLifecycle_1.getReservationExpiryHours)(), actorUserId: data.actorUserId, actorRole: data.actorRole }, (hasQuotationItems ? { quotationItems: data.quotationItems } : {})));
            const transaction = updateResult.transaction;
            const recipientEmail = ((_b = (_a = transaction.order) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.email) || null;
            const recipientName = ((_d = (_c = transaction.order) === null || _c === void 0 ? void 0 : _c.user) === null || _d === void 0 ? void 0 : _d.name) || "Customer";
            const recipientUserId = (_f = (_e = transaction.order) === null || _e === void 0 ? void 0 : _e.user) === null || _f === void 0 ? void 0 : _f.id;
            const customerType = ((_g = transaction.order) === null || _g === void 0 ? void 0 : _g.customerRoleSnapshot) ||
                (0, userRole_1.resolveCustomerTypeFromUser)((_h = transaction.order) === null || _h === void 0 ? void 0 : _h.user);
            const accountReference = recipientUserId
                ? (0, accountReference_1.toAccountReference)(recipientUserId)
                : "N/A";
            const issuedQuotation = hasQuotationItems &&
                updateResult.effectiveStatus === orderLifecycle_1.ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT;
            if (issuedQuotation) {
                const quotationItems = Array.isArray((_j = transaction.order) === null || _j === void 0 ? void 0 : _j.orderItems)
                    ? transaction.order.orderItems.map((item) => {
                        var _a, _b, _c;
                        return ({
                            productName: ((_b = (_a = item.variant) === null || _a === void 0 ? void 0 : _a.product) === null || _b === void 0 ? void 0 : _b.name) || "Product",
                            sku: ((_c = item.variant) === null || _c === void 0 ? void 0 : _c.sku) || item.variantId || "N/A",
                            quantity: Number(item.quantity) || 0,
                            unitPrice: Number(item.price) || 0,
                            lineTotal: (Number(item.quantity) || 0) * (Number(item.price) || 0),
                        });
                    })
                    : [];
                const originalOrderLog = Array.isArray((_k = transaction.order) === null || _k === void 0 ? void 0 : _k.quotationLogs)
                    ? transaction.order.quotationLogs.find((log) => (log === null || log === void 0 ? void 0 : log.event) === client_1.ORDER_QUOTATION_LOG_EVENT.ORIGINAL_ORDER)
                    : null;
                const originalOrderItems = this.normalizeQuotationLogLineItems(originalOrderLog === null || originalOrderLog === void 0 ? void 0 : originalOrderLog.lineItems);
                const originalOrderAmount = Number(originalOrderLog === null || originalOrderLog === void 0 ? void 0 : originalOrderLog.updatedTotal);
                yield this.notifyQuotationIssued({
                    recipientEmail,
                    recipientName,
                    customerType,
                    accountReference,
                    orderId: transaction.orderId,
                    reservationExpiresAt: ((_m = (_l = transaction.order) === null || _l === void 0 ? void 0 : _l.reservation) === null || _m === void 0 ? void 0 : _m.expiresAt) ||
                        ((_o = transaction.order) === null || _o === void 0 ? void 0 : _o.reservationExpiresAt),
                    quotationItems,
                    originalOrderItems: originalOrderItems.length > 0 ? originalOrderItems : quotationItems,
                    originalOrderAmount: Number.isFinite(originalOrderAmount)
                        ? originalOrderAmount
                        : null,
                    quotedAmount: Number((_p = transaction.order) === null || _p === void 0 ? void 0 : _p.amount) || 0,
                }).catch((error) => __awaiter(this, void 0, void 0, function* () {
                    const errorMessage = error instanceof Error ? error.message : "Unknown email error";
                    yield this.logsService.warn("Quotation notification email failed", {
                        transactionId: resolvedId,
                        orderId: transaction.orderId,
                        error: errorMessage,
                    });
                }));
            }
            else {
                yield this.notifyOrderStatusChange({
                    recipientEmail,
                    recipientName,
                    customerType,
                    accountReference,
                    orderId: transaction.orderId,
                    previousStatus: updateResult.previousStatus,
                    nextStatus: updateResult.effectiveStatus,
                }).catch((error) => __awaiter(this, void 0, void 0, function* () {
                    const errorMessage = error instanceof Error ? error.message : "Unknown email error";
                    yield this.logsService.warn("Order status notification email failed", {
                        transactionId: resolvedId,
                        orderId: transaction.orderId,
                        error: errorMessage,
                    });
                }));
            }
            yield this.notifyPromotedWaitlistedOrders(updateResult.promotedOrderIds);
            if (updateResult.effectiveStatus === orderLifecycle_1.ORDER_LIFECYCLE_STATUS.CONFIRMED) {
                this.invoiceService
                    .generateAndSendInvoiceForOrder(transaction.orderId)
                    .catch((error) => __awaiter(this, void 0, void 0, function* () {
                    if (this.invoiceService.isInvoiceTableMissing(error)) {
                        yield this.logsService.warn("Invoice table is missing. Skipping automated billing after order confirmation.", { orderId: transaction.orderId });
                        return;
                    }
                    const errorMessage = error instanceof Error ? error.message : "Unknown invoice error";
                    yield this.logsService.error("Automated invoice generation failed after order confirmation", {
                        orderId: transaction.orderId,
                        transactionId: resolvedId,
                        error: errorMessage,
                    });
                }));
            }
            return transaction;
        });
    }
    issueQuotation(id, quotationItems, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(quotationItems) || quotationItems.length === 0) {
                throw new AppError_1.default(400, "Quotation update requires at least one line item.");
            }
            return this.updateTransactionStatus(id, {
                status: orderLifecycle_1.ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT,
                quotationItems,
                actorUserId: actor === null || actor === void 0 ? void 0 : actor.actorUserId,
                actorRole: actor === null || actor === void 0 ? void 0 : actor.actorRole,
            });
        });
    }
    deleteTransaction(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const resolvedId = yield this.resolveTransactionId(id);
            yield this.transactionRepository.deleteTransaction(resolvedId);
        });
    }
}
exports.TransactionService = TransactionService;
