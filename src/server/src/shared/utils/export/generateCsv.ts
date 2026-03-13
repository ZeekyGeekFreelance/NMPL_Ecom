import formatAnalyticsData, { ExportSection } from "./formatAnalyticsData";

const EMPTY_VALUE = "";

const formatCsvCell = (value: unknown): string => {
  if (value === null || value === undefined) {
    return EMPTY_VALUE;
  }

  if (typeof value === "string") {
    return value.replace(/\s+/g, " ").trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatCsvCell(item)).join(" | ");
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nestedValue]) => `${key}: ${formatCsvCell(nestedValue)}`)
      .join("; ");
  }

  return String(value);
};

const escapeCsv = (value: unknown): string =>
  `"${formatCsvCell(value).replace(/"/g, '""')}"`;

const buildSectionCsv = (section: ExportSection): string[] => {
  const lines: string[] = [];

  lines.push(escapeCsv(`Section: ${section.title}`));

  if (!section.columns.length) {
    lines.push(escapeCsv("No columns available"));
    return lines;
  }

  lines.push(section.columns.map((column) => escapeCsv(column)).join(","));

  if (!section.rows.length) {
    lines.push(escapeCsv("No data available"));
    return lines;
  }

  section.rows.forEach((row) => {
    const values = section.columns.map((column) => escapeCsv(row[column]));
    lines.push(values.join(","));
  });

  return lines;
};

export default function generateCSV(data: unknown): string {
  const document = formatAnalyticsData(data);
  const lines: string[] = [];

  lines.push(`${escapeCsv("Report")},${escapeCsv(document.title)}`);
  lines.push(`${escapeCsv("Generated At")},${escapeCsv(document.generatedAt)}`);
  lines.push("");

  document.sections.forEach((section, index) => {
    lines.push(...buildSectionCsv(section));
    if (index < document.sections.length - 1) {
      lines.push("");
    }
  });

  // Include UTF-8 BOM so currency symbols render correctly in Excel.
  return `\uFEFF${lines.join("\n")}`;
}
