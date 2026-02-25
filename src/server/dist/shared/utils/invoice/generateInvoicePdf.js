"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = generateInvoicePdf;
const pdfkit_1 = __importDefault(require("pdfkit"));
const branding_1 = require("../branding");
const dateTime_1 = require("../dateTime");
const pdfFonts_1 = require("../pdfFonts");
const currency_1 = require("../currency");
const drawSectionTitle = (doc, label, fonts) => {
    doc.moveDown(0.5);
    doc.font(fonts.bold).fontSize(11).text(label);
    doc.moveDown(0.2);
};
const drawItemsTable = (doc, items, fonts, formatCurrency) => {
    doc.font(fonts.bold).fontSize(10);
    doc.text("SN No.", 50, doc.y, { width: 45 });
    doc.text("Item", 98, doc.y, { width: 215 });
    doc.text("Qty", 318, doc.y, { width: 40, align: "right" });
    doc.text("Unit Price", 365, doc.y, { width: 80, align: "right" });
    doc.text("Subtotal", 450, doc.y, { width: 95, align: "right" });
    doc.moveDown(0.4);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#d1d5db").stroke();
    doc.moveDown(0.4);
    doc.font(fonts.regular).fontSize(10);
    items.forEach((item, index) => {
        const rowY = doc.y;
        const itemTitle = `${item.productName} (${item.sku})`;
        doc.text(String(index + 1), 50, rowY, { width: 45 });
        doc.text(itemTitle, 98, rowY, { width: 215 });
        doc.text(String(item.quantity), 318, rowY, { width: 40, align: "right" });
        doc.text(formatCurrency(item.unitPrice), 365, rowY, {
            width: 80,
            align: "right",
        });
        doc.text(formatCurrency(item.subtotal), 450, rowY, {
            width: 95,
            align: "right",
        });
        const itemHeight = doc.heightOfString(itemTitle, { width: 215 });
        const rowHeight = Math.max(itemHeight, doc.currentLineHeight()) + 6;
        doc.y = rowY + rowHeight;
    });
};
function generateInvoicePdf(invoice) {
    return new Promise((resolve, reject) => {
        const platformName = (0, branding_1.getPlatformName)();
        const doc = new pdfkit_1.default({ margin: 50 });
        const chunks = [];
        const fonts = (0, pdfFonts_1.configurePdfFonts)(doc);
        const formatCurrency = (value) => fonts.supportsUnicode
            ? (0, currency_1.formatINRCurrency)(value)
            : `INR ${Number(value || 0).toFixed(2)}`;
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", (error) => reject(new Error(`Invoice PDF generation failed: ${error.message}`)));
        try {
            doc.font(fonts.bold).fontSize(11).text(platformName.toUpperCase(), {
                align: "left",
            });
            doc.moveDown(0.3);
            doc.font(fonts.bold).fontSize(22).text("INVOICE", {
                align: "left",
            });
            doc.moveDown(0.4);
            doc.font(fonts.regular).fontSize(10);
            doc.text(`Invoice #: ${invoice.invoiceNumber}`);
            doc.text(`Order ID: ${invoice.orderId}`);
            doc.text(`Date (IST): ${(0, dateTime_1.formatDateTimeInIST)(invoice.orderDate)}`);
            doc.text(`Generated At (IST): ${(0, dateTime_1.formatDateTimeInIST)(new Date())}`);
            doc.text(`Customer Type: ${invoice.customerType}`);
            drawSectionTitle(doc, "Bill To", fonts);
            doc.font(fonts.regular).fontSize(10);
            doc.text(invoice.customerName);
            if (invoice.accountReference) {
                doc.text(`Account Ref: ${invoice.accountReference}`);
            }
            doc.text(invoice.customerEmail);
            if (invoice.billingAddress) {
                doc.text(invoice.billingAddress.street);
                doc.text(`${invoice.billingAddress.city}, ${invoice.billingAddress.state} ${invoice.billingAddress.zip}`);
                doc.text(invoice.billingAddress.country);
            }
            drawSectionTitle(doc, "Items", fonts);
            if (!invoice.items.length) {
                doc.font(fonts.regular).fontSize(10).text("No items available.");
            }
            else {
                drawItemsTable(doc, invoice.items, fonts, formatCurrency);
            }
            doc.moveDown(0.8);
            doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#d1d5db").stroke();
            doc.moveDown(0.8);
            doc.font(fonts.bold).fontSize(12);
            doc.text(`Total: ${formatCurrency(invoice.totalAmount)}`, 50, doc.y, {
                align: "right",
            });
            doc.moveDown(1);
            doc
                .font(fonts.regular)
                .fontSize(9)
                .fillColor("#6b7280")
                .text(`${platformName} system generated invoice. No signature required.`, {
                align: "left",
            });
            doc.end();
        }
        catch (error) {
            doc.end();
            const message = error instanceof Error ? error.message : "Unknown generation error";
            reject(new Error(`Invoice PDF generation failed: ${message}`));
        }
    });
}
