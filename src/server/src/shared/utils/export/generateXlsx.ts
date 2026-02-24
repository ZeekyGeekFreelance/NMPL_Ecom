import ExcelJS from "exceljs";
import formatAnalyticsData, { ExportSection } from "./formatAnalyticsData";

const EXCEL_MAX_SHEET_NAME_LENGTH = 31;

const toSheetName = (input: string, index: number): string => {
  const safe = input
    .replace(/[\\/*?:[\]]/g, "")
    .trim();

  const fallback = `Sheet ${index + 1}`;
  const withFallback = safe || fallback;

  return withFallback.length > EXCEL_MAX_SHEET_NAME_LENGTH
    ? withFallback.slice(0, EXCEL_MAX_SHEET_NAME_LENGTH)
    : withFallback;
};

const toCellValue = (value: unknown): ExcelJS.CellValue => {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "")).join(" | ");
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nestedValue]) => `${key}: ${String(nestedValue ?? "")}`)
      .join("; ");
  }

  return String(value);
};

const getColumnWidth = (
  column: string,
  rows: Array<Record<string, unknown>>
): number => {
  const headerWidth = column.length + 2;
  const contentWidth = rows.reduce((maxWidth, row) => {
    const cell = toCellValue(row[column]);
    const text = typeof cell === "string" ? cell : String(cell ?? "");
    return Math.max(maxWidth, text.length + 2);
  }, 0);

  return Math.min(Math.max(headerWidth, contentWidth, 14), 44);
};

const fillSheet = (sheet: ExcelJS.Worksheet, section: ExportSection) => {
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
    const row = sheet.addRow(
      Object.fromEntries(section.columns.map((column) => [column, "No data available"]))
    );
    row.font = { italic: true, color: { argb: "FF6B7280" } };
  } else {
    section.rows.forEach((row) => {
      const normalizedRow = Object.fromEntries(
        section.columns.map((column) => [column, toCellValue(row[column])])
      );
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
    row.alignment = {
      vertical: "middle",
      horizontal: rowNumber === 1 ? "center" : "left",
      wrapText: true,
    };
  });
};

export default async function generateXLSX(data: unknown): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const document = formatAnalyticsData(data);

  workbook.creator = "Ecommerce Export Engine";
  workbook.created = new Date();
  workbook.modified = new Date();

  document.sections.forEach((section, index) => {
    const sheetName = toSheetName(section.title || section.key, index);
    const sheet = workbook.addWorksheet(sheetName);
    fillSheet(sheet, section);
  });

  return workbook.xlsx.writeBuffer() as Promise<Buffer>;
}
