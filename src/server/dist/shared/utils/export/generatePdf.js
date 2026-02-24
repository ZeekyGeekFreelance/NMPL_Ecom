"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = generatePDF;
const pdfkit_1 = __importDefault(require("pdfkit"));
const formatAnalyticsData_1 = __importDefault(require("./formatAnalyticsData"));
const PAGE_MARGIN = 44;
const BODY_FONT_SIZE = 9;
const TITLE_FONT_SIZE = 18;
const HEADING_FONT_SIZE = 13;
const SECTION_SPACING = 14;
const formatCell = (value) => {
    if (value === null || value === undefined || value === "") {
        return "";
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (Array.isArray(value)) {
        return value.map((item) => formatCell(item)).join(" | ");
    }
    if (typeof value === "object") {
        return Object.entries(value)
            .map(([key, nestedValue]) => `${key}: ${formatCell(nestedValue)}`)
            .join("; ");
    }
    return String(value).replace(/\s+/g, " ").trim();
};
const ensureVerticalSpace = (doc, requiredHeight = 28) => {
    const bottomLimit = doc.page.height - PAGE_MARGIN;
    if (doc.y + requiredHeight > bottomLimit) {
        doc.addPage();
    }
};
const renderSectionTable = (doc, section) => {
    ensureVerticalSpace(doc, 60);
    doc
        .font("Helvetica-Bold")
        .fontSize(HEADING_FONT_SIZE)
        .text(section.title, { underline: true })
        .moveDown(0.5);
    if (!section.columns.length) {
        doc.font("Helvetica").fontSize(BODY_FONT_SIZE).text("No columns available").moveDown(1);
        return;
    }
    const headerLine = section.columns.join(" | ");
    doc.font("Helvetica-Bold").fontSize(BODY_FONT_SIZE).text(headerLine, {
        width: doc.page.width - PAGE_MARGIN * 2,
    });
    if (!section.rows.length) {
        doc
            .font("Helvetica")
            .fontSize(BODY_FONT_SIZE)
            .text("No data available", { width: doc.page.width - PAGE_MARGIN * 2 })
            .moveDown(1);
        return;
    }
    doc.moveDown(0.3);
    section.rows.forEach((row) => {
        const rowLine = section.columns
            .map((column) => formatCell(row[column]))
            .join(" | ");
        ensureVerticalSpace(doc, 22);
        doc.font("Helvetica").fontSize(BODY_FONT_SIZE).text(rowLine, {
            width: doc.page.width - PAGE_MARGIN * 2,
        });
    });
    doc.moveDown(SECTION_SPACING / 12);
};
function generatePDF(data) {
    return new Promise((resolve, reject) => {
        const doc = new pdfkit_1.default({ margin: PAGE_MARGIN });
        const buffers = [];
        doc.on("data", (chunk) => buffers.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(buffers)));
        doc.on("error", (err) => reject(new Error(`PDF generation failed: ${err.message}`)));
        try {
            const document = (0, formatAnalyticsData_1.default)(data);
            doc.font("Helvetica-Bold").fontSize(TITLE_FONT_SIZE).text(document.title, {
                align: "center",
            });
            doc
                .moveDown(0.4)
                .font("Helvetica")
                .fontSize(10)
                .fillColor("#4B5563")
                .text(`Generated: ${document.generatedAt}`, { align: "center" });
            doc.moveDown(1);
            doc.fillColor("#111827");
            document.sections.forEach((section) => {
                renderSectionTable(doc, section);
            });
            doc.end();
        }
        catch (err) {
            doc.end();
            reject(new Error(`PDF generation failed: ${err.message}`));
        }
    });
}
