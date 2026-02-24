const normalizeText = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

const isPrimitiveValue = (value: unknown): value is string | number | boolean =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === "[object Object]";

const toCellString = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (isPrimitiveValue(value)) {
    return normalizeText(String(value));
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => toCellString(item))
      .filter((item) => item.length > 0);
    return parts.join(" | ");
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value)
      .map(([key, nestedValue]) => {
        const text = toCellString(nestedValue);
        if (!text) {
          return "";
        }
        return `${key}: ${text}`;
      })
      .filter(Boolean);

    return entries.join("; ");
  }

  return normalizeText(String(value));
};

const escapeCsvValue = (value: string): string =>
  `"${value.replace(/"/g, '""')}"`;

export const getNestedValue = (row: Record<string, unknown>, key: string): unknown =>
  key
    .split(".")
    .reduce<unknown>(
      (accumulator, currentKey) =>
        accumulator &&
        typeof accumulator === "object" &&
        currentKey in (accumulator as Record<string, unknown>)
          ? (accumulator as Record<string, unknown>)[currentKey]
          : undefined,
      row
    );

export const formatExportCell = (value: unknown): string => toCellString(value);

export const buildCsv = (
  headers: string[],
  rows: Array<Record<string, unknown>>
): string => {
  const headerRow = headers.map((header) => escapeCsvValue(header)).join(",");
  const bodyRows = rows.map((row) =>
    headers
      .map((header) => escapeCsvValue(formatExportCell(row[header])))
      .join(",")
  );

  return [headerRow, ...bodyRows].join("\n");
};

export const downloadCsv = (csvContent: string, filename: string) => {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportToCSV = (
  data: Array<Record<string, unknown>>,
  filename: string
) => {
  if (!Array.isArray(data) || data.length === 0) {
    return;
  }

  const headers = Object.keys(data[0]);
  const csvString = buildCsv(headers, data);
  downloadCsv(csvString, filename);
};
