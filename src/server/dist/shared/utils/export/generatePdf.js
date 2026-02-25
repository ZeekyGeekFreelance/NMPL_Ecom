"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = generatePDF;
const pdfkit_1 = __importDefault(require("pdfkit"));
const formatAnalyticsData_1 = __importDefault(require("./formatAnalyticsData"));
const pdfFonts_1 = require("@/shared/utils/pdfFonts");
const PAGE_MARGIN = 44;
const TITLE_FONT_SIZE = 18;
const META_FONT_SIZE = 10;
const HEADING_FONT_SIZE = 13;
const BODY_FONT_SIZE = 9;
const TABLE_HEADER_HEIGHT = 22;
const CELL_PADDING_X = 4;
const CELL_PADDING_Y = 4;
const SECTION_SPACING = 14;
const MIN_COLUMN_WIDTH = 48;
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
            .filter((entry) => !entry.endsWith(": "))
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
const estimateColumnWeight = (section, column) => {
    const headerWeight = Math.min(column.length, 32);
    const contentWeight = section.rows.reduce((maxWeight, row) => {
        const content = formatCell(row[column]);
        if (!content) {
            return maxWeight;
        }
        // Keep width estimate bounded so one long field does not break the table.
        const boundedLength = Math.min(content.length, 42);
        return Math.max(maxWeight, boundedLength);
    }, 0);
    return Math.max(headerWeight, contentWeight, 8);
};
const buildColumnLayout = (doc, section) => {
    const tableWidth = doc.page.width - PAGE_MARGIN * 2;
    const columnCount = Math.max(section.columns.length, 1);
    const equalWidth = tableWidth / columnCount;
    const weights = section.columns.map((column) => estimateColumnWeight(section, column));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || columnCount;
    let rawWidths = weights.map((weight) => Math.max(MIN_COLUMN_WIDTH, (weight / totalWeight) * tableWidth));
    const totalRawWidth = rawWidths.reduce((sum, width) => sum + width, 0);
    if (totalRawWidth > tableWidth) {
        const scale = tableWidth / totalRawWidth;
        rawWidths = rawWidths.map((width) => Math.max(equalWidth * 0.55, width * scale));
    }
    const normalizedTotal = rawWidths.reduce((sum, width) => sum + width, 0);
    if (normalizedTotal < tableWidth) {
        const remaining = tableWidth - normalizedTotal;
        const increment = remaining / rawWidths.length;
        rawWidths = rawWidths.map((width) => width + increment);
    }
    let currentX = PAGE_MARGIN;
    return section.columns.map((column, index) => {
        const width = index === section.columns.length - 1
            ? tableWidth - (currentX - PAGE_MARGIN)
            : rawWidths[index];
        const layout = {
            key: column,
            x: currentX,
            width,
        };
        currentX += width;
        return layout;
    });
};
const isNumericLikeColumn = (columnName) => {
    const normalized = columnName.replace(/\s+/g, "").toLowerCase();
    return (normalized.includes("snno") ||
        normalized.includes("rank") ||
        normalized.includes("qty") ||
        normalized.includes("quantity") ||
        normalized.includes("count") ||
        normalized.includes("price") ||
        normalized.includes("revenue") ||
        normalized.includes("amount") ||
        normalized.includes("total") ||
        normalized.includes("spent") ||
        normalized.includes("value"));
};
const isNumericLikeValue = (value) => {
    const normalized = value.replace(/[\u20B9,\s]/g, "");
    return /^-?\d+(\.\d+)?$/.test(normalized);
};
const normalizeForFont = (value, supportsUnicode) => supportsUnicode ? value : value.replace(/\u20B9/g, "INR ");
const drawTableHeader = (doc, layout, fonts) => {
    const startY = doc.y;
    layout.forEach((column) => {
        doc
            .rect(column.x, startY, column.width, TABLE_HEADER_HEIGHT)
            .fillAndStroke("#E5E7EB", "#D1D5DB");
        doc
            .fillColor("#111827")
            .font(fonts.bold)
            .fontSize(BODY_FONT_SIZE)
            .text(column.key, column.x + CELL_PADDING_X, startY + 6, {
            width: column.width - CELL_PADDING_X * 2,
            align: isNumericLikeColumn(column.key) ? "right" : "left",
        });
    });
    doc.y = startY + TABLE_HEADER_HEIGHT;
};
const drawTableRows = (doc, section, layout, fonts) => {
    const bottomLimit = doc.page.height - PAGE_MARGIN;
    if (!section.rows.length) {
        ensureVerticalSpace(doc, 26);
        doc
            .font(fonts.regular)
            .fontSize(BODY_FONT_SIZE)
            .fillColor("#6B7280")
            .text("No data available", PAGE_MARGIN, doc.y + 8, {
            width: doc.page.width - PAGE_MARGIN * 2,
        });
        doc.y += 22;
        return;
    }
    section.rows.forEach((row) => {
        const rowValues = layout.map((column) => normalizeForFont(formatCell(row[column.key]), fonts.supportsUnicode));
        const cellHeights = rowValues.map((value, index) => doc.heightOfString(value || "", {
            width: layout[index].width - CELL_PADDING_X * 2,
            align: isNumericLikeColumn(layout[index].key) || isNumericLikeValue(value)
                ? "right"
                : "left",
        }));
        const rowHeight = Math.max(...cellHeights, doc.currentLineHeight()) + CELL_PADDING_Y * 2;
        if (doc.y + rowHeight > bottomLimit) {
            doc.addPage();
            drawTableHeader(doc, layout, fonts);
        }
        const rowY = doc.y;
        layout.forEach((column, index) => {
            const value = rowValues[index];
            const align = isNumericLikeColumn(column.key) || isNumericLikeValue(value)
                ? "right"
                : "left";
            doc
                .rect(column.x, rowY, column.width, rowHeight)
                .strokeColor("#E5E7EB")
                .stroke();
            doc
                .font(fonts.regular)
                .fontSize(BODY_FONT_SIZE)
                .fillColor("#111827")
                .text(value, column.x + CELL_PADDING_X, rowY + CELL_PADDING_Y, {
                width: column.width - CELL_PADDING_X * 2,
                align,
            });
        });
        doc.y = rowY + rowHeight;
    });
};
const renderSectionTable = (doc, section, fonts) => {
    ensureVerticalSpace(doc, 74);
    doc
        .font(fonts.bold)
        .fontSize(HEADING_FONT_SIZE)
        .fillColor("#111827")
        .text(section.title, { underline: true })
        .moveDown(0.5);
    if (!section.columns.length) {
        doc
            .font(fonts.regular)
            .fontSize(BODY_FONT_SIZE)
            .fillColor("#6B7280")
            .text("No columns available")
            .moveDown(1);
        return;
    }
    const layout = buildColumnLayout(doc, section);
    drawTableHeader(doc, layout, fonts);
    drawTableRows(doc, section, layout, fonts);
    doc.moveDown(SECTION_SPACING / 12);
};
function generatePDF(data) {
    return new Promise((resolve, reject) => {
        const doc = new pdfkit_1.default({ margin: PAGE_MARGIN });
        const buffers = [];
        const fonts = (0, pdfFonts_1.configurePdfFonts)(doc);
        doc.on("data", (chunk) => buffers.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(buffers)));
        doc.on("error", (err) => reject(new Error(`PDF generation failed: ${err.message}`)));
        try {
            const document = (0, formatAnalyticsData_1.default)(data);
            doc
                .font(fonts.bold)
                .fontSize(TITLE_FONT_SIZE)
                .fillColor("#111827")
                .text(document.title, {
                align: "center",
            });
            doc
                .moveDown(0.4)
                .font(fonts.regular)
                .fontSize(META_FONT_SIZE)
                .fillColor("#4B5563")
                .text(`Generated: ${document.generatedAt}`, { align: "center" });
            doc.moveDown(1);
            doc.fillColor("#111827");
            document.sections.forEach((section) => {
                renderSectionTable(doc, section, fonts);
            });
            doc.end();
        }
        catch (err) {
            doc.end();
            reject(new Error(`PDF generation failed: ${err.message}`));
        }
    });
}
