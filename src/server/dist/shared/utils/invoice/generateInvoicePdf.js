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
const toSafeText = (value, fallback = "N/A") => {
    const normalized = String(value !== null && value !== void 0 ? value : "").trim();
    return normalized || fallback;
};
const drawAddressBlock = (doc, address, fallbackName, fallbackPhone, contactLabel = "Receiver") => {
    if (!address) {
        doc.fontSize(10).text("Address details are unavailable.");
        return;
    }
    doc
        .fontSize(10)
        .text(`${contactLabel}: ${toSafeText(address.fullName, fallbackName)}`);
    doc.fontSize(10).text(`Phone: ${toSafeText(address.phoneNumber, fallbackPhone)}`);
    doc.fontSize(10).text(toSafeText(address.line1, "Address line not available"));
    if (address.line2) {
        doc.fontSize(10).text(address.line2);
    }
    if (address.landmark) {
        doc.fontSize(10).text(`Landmark: ${address.landmark}`);
    }
    doc
        .fontSize(10)
        .text(`${toSafeText(address.city)}, ${toSafeText(address.state)} ${toSafeText(address.pincode)}`);
    doc.fontSize(10).text(toSafeText(address.country));
};
const drawItemsTable = (doc, items, fonts, formatCurrency) => {
    const left = 50;
    const right = 545;
    const pageBottom = () => doc.page.height - doc.page.margins.bottom;
    const columns = [
        { key: "product", label: "Product", x: 50, width: 205, align: "left" },
        { key: "sku", label: "SKU", x: 260, width: 95, align: "left" },
        { key: "qty", label: "Qty", x: 360, width: 50, align: "right" },
        { key: "unit", label: "Unit Price", x: 415, width: 60, align: "right" },
        { key: "line", label: "Line Total", x: 480, width: 65, align: "right" },
    ];
    const drawTableHeader = () => {
        doc.font(fonts.bold).fontSize(9.5);
        columns.forEach((column) => {
            doc.text(column.label, column.x, doc.y, {
                width: column.width,
                align: column.align,
            });
        });
        doc.moveDown(0.35);
        doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#d1d5db").stroke();
        doc.moveDown(0.35);
    };
    drawTableHeader();
    if (!items.length) {
        doc
            .font(fonts.regular)
            .fontSize(10)
            .text("No items available.", left, doc.y, { width: right - left });
        return;
    }
    doc.font(fonts.regular).fontSize(9.5);
    items.forEach((item) => {
        const productName = toSafeText(item.productName, "Product");
        const sku = toSafeText(item.sku, "-");
        const quantity = String(Number(item.quantity) || 0);
        const unitPrice = formatCurrency(Number(item.unitPrice) || 0);
        const lineTotal = formatCurrency(Number(item.subtotal) || 0);
        const productHeight = doc.heightOfString(productName, {
            width: columns[0].width,
            align: "left",
        });
        const skuHeight = doc.heightOfString(sku, {
            width: columns[1].width,
            align: "left",
        });
        const rowHeight = Math.max(productHeight, skuHeight, doc.currentLineHeight()) + 6;
        if (doc.y + rowHeight > pageBottom() - 70) {
            doc.addPage();
            drawTableHeader();
            doc.font(fonts.regular).fontSize(9.5);
        }
        const rowY = doc.y;
        doc.text(productName, columns[0].x, rowY, {
            width: columns[0].width,
            align: "left",
        });
        doc.text(sku, columns[1].x, rowY, {
            width: columns[1].width,
            align: "left",
        });
        doc.text(quantity, columns[2].x, rowY, {
            width: columns[2].width,
            align: "right",
        });
        doc.text(unitPrice, columns[3].x, rowY, {
            width: columns[3].width,
            align: "right",
        });
        doc.text(lineTotal, columns[4].x, rowY, {
            width: columns[4].width,
            align: "right",
        });
        doc.y = rowY + rowHeight;
        doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#eef2f7").stroke();
        doc.moveDown(0.2);
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
            const normalizedDeliveryMode = String(invoice.deliveryMode || "DELIVERY")
                .trim()
                .toUpperCase();
            const deliveryLabel = normalizedDeliveryMode === "PICKUP" ? "In-Store Pickup" : "Delivery";
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
            doc.text(`Order Date (IST): ${(0, dateTime_1.formatDateTimeInIST)(invoice.orderDate)}`);
            doc.text(`Generated At (IST): ${(0, dateTime_1.formatDateTimeInIST)(new Date())}`);
            drawSectionTitle(doc, "Billing Identity", fonts);
            doc.font(fonts.regular).fontSize(10);
            doc.text(`Customer Name: ${toSafeText(invoice.customerName, "Customer")}`);
            doc.text(`Phone: ${toSafeText(invoice.customerPhone, "Not provided")}`);
            doc.text(`Email: ${toSafeText(invoice.customerEmail)}`);
            doc.text(`Customer Type: ${toSafeText(invoice.customerType)}`);
            if (invoice.accountReference) {
                doc.text(`Account Ref: ${invoice.accountReference}`);
            }
            drawSectionTitle(doc, "Fulfillment", fonts);
            doc
                .font(fonts.regular)
                .fontSize(10)
                .text(`Fulfillment Mode: ${deliveryLabel}`);
            drawSectionTitle(doc, toSafeText(invoice.locationLabel, normalizedDeliveryMode === "PICKUP" ? "Pickup Location" : "Delivery To"), fonts);
            drawAddressBlock(doc, invoice.locationAddress, invoice.customerName, toSafeText(invoice.customerPhone, "Not provided"), normalizedDeliveryMode === "PICKUP" ? "Store" : "Receiver");
            drawSectionTitle(doc, "Items", fonts);
            drawItemsTable(doc, invoice.items, fonts, formatCurrency);
            doc.moveDown(0.8);
            doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#d1d5db").stroke();
            doc.moveDown(0.8);
            doc.font(fonts.regular).fontSize(10);
            doc.text(`Subtotal: ${formatCurrency(invoice.subtotalAmount)}`, 50, doc.y, {
                align: "right",
            });
            doc.moveDown(0.3);
            doc.text(`${deliveryLabel}: ${formatCurrency(invoice.deliveryCharge)}`, 50, doc.y, {
                align: "right",
            });
            doc.moveDown(0.3);
            doc.font(fonts.bold).fontSize(12);
            doc.text(`Final Total: ${formatCurrency(invoice.totalAmount)}`, 50, doc.y, {
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
