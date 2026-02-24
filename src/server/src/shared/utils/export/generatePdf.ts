import PDFDocument from "pdfkit";
import formatAnalyticsData, { ExportSection } from "./formatAnalyticsData";

const PAGE_MARGIN = 44;
const BODY_FONT_SIZE = 9;
const TITLE_FONT_SIZE = 18;
const HEADING_FONT_SIZE = 13;
const SECTION_SPACING = 14;

const formatCell = (value: unknown): string => {
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
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nestedValue]) => `${key}: ${formatCell(nestedValue)}`)
      .join("; ");
  }

  return String(value).replace(/\s+/g, " ").trim();
};

const ensureVerticalSpace = (doc: PDFKit.PDFDocument, requiredHeight = 28) => {
  const bottomLimit = doc.page.height - PAGE_MARGIN;
  if (doc.y + requiredHeight > bottomLimit) {
    doc.addPage();
  }
};

const renderSectionTable = (doc: PDFKit.PDFDocument, section: ExportSection) => {
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

export default function generatePDF(data: unknown): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: PAGE_MARGIN });
    const buffers: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", (err: Error) =>
      reject(new Error(`PDF generation failed: ${err.message}`))
    );

    try {
      const document = formatAnalyticsData(data);

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
    } catch (err: any) {
      doc.end();
      reject(new Error(`PDF generation failed: ${err.message}`));
    }
  });
}
