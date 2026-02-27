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
exports.default = generateXLSX;
const exceljs_1 = __importDefault(require("exceljs"));
const formatAnalyticsData_1 = __importDefault(require("./formatAnalyticsData"));
const branding_1 = require("@/shared/utils/branding");
const EXCEL_MAX_SHEET_NAME_LENGTH = 31;
const toSheetName = (input, index) => {
    const safe = input
        .replace(/[\\/*?:[\]]/g, "")
        .trim();
    const fallback = `Sheet ${index + 1}`;
    const withFallback = safe || fallback;
    return withFallback.length > EXCEL_MAX_SHEET_NAME_LENGTH
        ? withFallback.slice(0, EXCEL_MAX_SHEET_NAME_LENGTH)
        : withFallback;
};
const toCellValue = (value) => {
    if (value === null || value === undefined || value === "") {
        return "";
    }
    if (typeof value === "string") {
        return value.replace(/\s+/g, " ").trim();
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return value;
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (Array.isArray(value)) {
        return value
            .map((item) => toCellValue(item))
            .map((item) => String(item !== null && item !== void 0 ? item : ""))
            .filter((item) => item !== "")
            .join(" | ");
    }
    if (typeof value === "object") {
        return Object.entries(value)
            .map(([key, nestedValue]) => { var _a; return `${key}: ${String((_a = toCellValue(nestedValue)) !== null && _a !== void 0 ? _a : "")}`; })
            .filter((row) => !row.endsWith(": "))
            .join("; ");
    }
    return String(value);
};
const isCurrencyOrNumericColumn = (column) => {
    const normalized = column.replace(/\s+/g, "").toLowerCase();
    return (normalized.includes("revenue") ||
        normalized.includes("price") ||
        normalized.includes("amount") ||
        normalized.includes("total") ||
        normalized.includes("spent") ||
        normalized.includes("value"));
};
const isNumericCell = (value) => {
    if (typeof value === "number") {
        return true;
    }
    if (typeof value !== "string") {
        return false;
    }
    const normalized = value.replace(/[,\s\u20B9]/g, "");
    return /^-?\d+(\.\d+)?$/.test(normalized);
};
const getColumnWidth = (column, rows) => {
    const headerWidth = column.length + 2;
    const contentWidth = rows.reduce((maxWidth, row) => {
        const cell = toCellValue(row[column]);
        const text = typeof cell === "string" ? cell : String(cell !== null && cell !== void 0 ? cell : "");
        return Math.max(maxWidth, text.length + 2);
    }, 0);
    return Math.min(Math.max(headerWidth, contentWidth, 14), 44);
};
const fillSheet = (sheet, section) => {
    if (!section.columns.length) {
        sheet.addRow(["No columns available"]);
        return;
    }
    sheet.columns = section.columns.map((column) => ({
        header: column,
        key: column,
        width: getColumnWidth(column, section.rows),
    }));
    if (!section.rows.length) {
        const row = sheet.addRow(Object.fromEntries(section.columns.map((column) => [column, "No data available"])));
        row.font = { italic: true, color: { argb: "FF6B7280" } };
    }
    else {
        section.rows.forEach((row) => {
            const normalizedRow = Object.fromEntries(section.columns.map((column) => [column, toCellValue(row[column])]));
            sheet.addRow(normalizedRow);
        });
    }
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FF1F2937" } };
    headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE5E7EB" },
    };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
            const column = section.columns[colNumber - 1] || "";
            const shouldRightAlign = rowNumber > 1 &&
                (isCurrencyOrNumericColumn(column) || isNumericCell(cell.value));
            cell.alignment = {
                vertical: "middle",
                horizontal: rowNumber === 1 ? "center" : shouldRightAlign ? "right" : "left",
                wrapText: true,
            };
        });
    });
};
function generateXLSX(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const workbook = new exceljs_1.default.Workbook();
        const document = (0, formatAnalyticsData_1.default)(data);
        const platformName = (0, branding_1.getPlatformName)();
        workbook.creator = `${platformName} Export Engine`;
        workbook.created = new Date();
        workbook.modified = new Date();
        document.sections.forEach((section, index) => {
            const sheetName = toSheetName(section.title || section.key, index);
            const sheet = workbook.addWorksheet(sheetName);
            fillSheet(sheet, section);
        });
        const buffer = yield workbook.xlsx.writeBuffer();
        return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    });
}
