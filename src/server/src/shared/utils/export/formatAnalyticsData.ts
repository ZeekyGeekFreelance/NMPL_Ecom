import {
  AllAnalytics,
  AnalyticsOverview,
  ExportableData,
  ProductPerformance,
  UserAnalytics,
} from "@/modules/analytics/analytics.types";
import {
  AllReports,
  ReportData,
  SalesReport,
  UserRetentionReport,
} from "@/modules/reports/reports.types";
import {
  toAccountReference,
  toOrderReference,
  toPaymentReference,
  toProductReference,
  toTransactionReference,
} from "@/shared/utils/accountReference";

export interface ExportSection {
  key: string;
  title: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
}

export interface ExportDocument {
  title: string;
  generatedAt: string;
  sections: ExportSection[];
}

const EMPTY_VALUE = "";
const FALLBACK_SKU_VALUE = "N/A";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CURRENCY_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const isPrimitive = (value: unknown): value is string | number | boolean =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

const normalizeRoleValue = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value;
  }

  const role = value.trim().toUpperCase();
  if (!role) {
    return EMPTY_VALUE;
  }

  if (role === "CLIENT") {
    return "USER";
  }

  return role;
};

const toReferenceValue = (key: string, value: unknown): unknown => {
  if (typeof value !== "string") {
    return value;
  }

  const raw = value.trim();
  if (!UUID_PATTERN.test(raw)) {
    return value;
  }

  const normalizedKey = key.replace(/\s+/g, "").toLowerCase();

  if (normalizedKey.includes("orderid")) {
    return toOrderReference(raw);
  }

  if (normalizedKey.includes("paymentid")) {
    return toPaymentReference(raw);
  }

  if (normalizedKey.includes("transactionid")) {
    return toTransactionReference(raw);
  }

  if (normalizedKey.includes("userid") || normalizedKey.includes("accountid")) {
    return toAccountReference(raw);
  }

  if (normalizedKey.includes("productid")) {
    return toProductReference(raw);
  }

  return value;
};

const toExportCell = (key: string, value: unknown): unknown => {
  const normalizedKey = key.replace(/\s+/g, "").toLowerCase();
  const roleKey =
    normalizedKey.includes("role") || normalizedKey.includes("customertype");

  if (roleKey) {
    return normalizeCell(normalizeRoleValue(value));
  }

  return normalizeCell(toReferenceValue(key, value));
};

const normalizeCell = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return EMPTY_VALUE;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (isPrimitive(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeCell(item))
      .filter((item) => item !== EMPTY_VALUE)
      .join(" | ");
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nestedValue]) => {
        const nextValue = normalizeCell(nestedValue);
        return nextValue === EMPTY_VALUE ? "" : `${key}: ${nextValue}`;
      })
      .filter(Boolean)
      .join("; ");
  }

  return String(value);
};

const toNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toFixedNumber = (value: unknown, digits = 2): number | string => {
  const parsed = toNumber(value);
  return parsed === null ? EMPTY_VALUE : Number(parsed.toFixed(digits));
};

const toCurrencyValue = (value: unknown): string => {
  const parsed = toNumber(value);
  return parsed === null ? EMPTY_VALUE : CURRENCY_FORMATTER.format(parsed);
};

const toSkuValue = (value: unknown): string => {
  if (typeof value !== "string") {
    return FALLBACK_SKU_VALUE;
  }

  const normalized = value.trim();
  return normalized || FALLBACK_SKU_VALUE;
};

const buildMetricsSection = (
  key: string,
  title: string,
  metrics: Array<[string, unknown]>
): ExportSection => ({
  key,
  title,
  columns: ["Metric", "Value"],
  rows: metrics.map(([metric, value]) => ({
    Metric: metric,
    Value: toExportCell(metric, value),
  })),
});

const buildRowsFromSeries = (
  labels: string[] = [],
  series: Array<{ key: string; values: unknown[] }>
) => {
  const maxLength = Math.max(
    labels.length,
    ...series.map((item) => item.values.length),
    0
  );

  return Array.from({ length: maxLength }, (_, index) => {
    const row: Record<string, unknown> = {
      Period: labels[index] || EMPTY_VALUE,
    };

    series.forEach((item) => {
      row[item.key] =
        item.values[index] === undefined
          ? EMPTY_VALUE
          : toExportCell(item.key, item.values[index]);
    });

    return row;
  });
};

const flattenRecord = (
  value: unknown,
  prefix = "",
  output: Record<string, unknown> = {}
): Record<string, unknown> => {
  if (value === null || value === undefined) {
    if (prefix) {
      output[prefix] = EMPTY_VALUE;
    }
    return output;
  }

  if (value instanceof Date || isPrimitive(value)) {
    if (prefix) {
      output[prefix] = normalizeCell(value);
    }
    return output;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      if (prefix) {
        output[prefix] = EMPTY_VALUE;
      }
      return output;
    }

    const everyPrimitive = value.every(
      (item) => item === null || item === undefined || isPrimitive(item)
    );

    if (everyPrimitive) {
      output[prefix] = normalizeCell(value);
      return output;
    }

    value.forEach((item, index) => {
      const key = prefix ? `${prefix}.${index + 1}` : String(index + 1);
      flattenRecord(item, key, output);
    });

    return output;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length && prefix) {
    output[prefix] = EMPTY_VALUE;
    return output;
  }

  entries.forEach(([key, nestedValue]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    flattenRecord(nestedValue, nextPrefix, output);
  });

  return output;
};

const titleCaseKey = (value: string): string =>
  value
    .split(".")
    .map((part) =>
      part
        .replace(/([A-Z])/g, " $1")
        .replace(/[_-]/g, " ")
        .trim()
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/^./, (char) => char.toUpperCase());

const buildFallbackDocument = (data: unknown): ExportDocument => {
  const rows = Array.isArray(data)
    ? data.map((item) => flattenRecord(item))
    : [flattenRecord(data)];

  const columns = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row)))
  ).map((column) => titleCaseKey(column));

  const normalizedRows = rows.map((row) => {
    const mappedRow: Record<string, unknown> = {};
    columns.forEach((column) => {
      const originalColumn = Object.keys(row).find(
        (key) => titleCaseKey(key) === column
      );
      mappedRow[column] =
        originalColumn === undefined
          ? EMPTY_VALUE
          : toExportCell(originalColumn, row[originalColumn]);
    });
    return mappedRow;
  });

  return {
    title: "Data Export",
    generatedAt: new Date().toISOString(),
    sections: [
      {
        key: "fallback",
        title: "Flattened Data",
        columns,
        rows: normalizedRows,
      },
    ],
  };
};

const isAllAnalytics = (data: unknown): data is AllAnalytics =>
  !!data &&
  typeof data === "object" &&
  "overview" in (data as Record<string, unknown>) &&
  "products" in (data as Record<string, unknown>) &&
  "users" in (data as Record<string, unknown>);

const isAnalyticsOverview = (data: unknown): data is AnalyticsOverview =>
  !!data &&
  typeof data === "object" &&
  "monthlyTrends" in (data as Record<string, unknown>) &&
  "totalOrders" in (data as Record<string, unknown>) &&
  "averageOrderValue" in (data as Record<string, unknown>);

const isUserAnalytics = (data: unknown): data is UserAnalytics =>
  !!data &&
  typeof data === "object" &&
  "interactionTrends" in (data as Record<string, unknown>) &&
  "topUsers" in (data as Record<string, unknown>) &&
  "engagementScore" in (data as Record<string, unknown>);

const isProductPerformanceArray = (
  data: unknown
): data is ProductPerformance[] =>
  Array.isArray(data) &&
  data.every(
    (item) =>
      item &&
      typeof item === "object" &&
      "id" in (item as Record<string, unknown>) &&
      "name" in (item as Record<string, unknown>)
  );

const isAllReports = (data: unknown): data is AllReports =>
  !!data &&
  typeof data === "object" &&
  "sales" in (data as Record<string, unknown>) &&
  "userRetention" in (data as Record<string, unknown>);

const isSalesReport = (data: unknown): data is SalesReport =>
  !!data &&
  typeof data === "object" &&
  "byCategory" in (data as Record<string, unknown>) &&
  "topProducts" in (data as Record<string, unknown>) &&
  "totalRevenue" in (data as Record<string, unknown>);

const isUserRetentionReport = (data: unknown): data is UserRetentionReport =>
  !!data &&
  typeof data === "object" &&
  "topUsers" in (data as Record<string, unknown>) &&
  "retentionRate" in (data as Record<string, unknown>) &&
  "lifetimeValue" in (data as Record<string, unknown>);

const buildSalesSections = (sales: SalesReport): ExportSection[] => [
  buildMetricsSection("sales-metrics", "Sales Metrics", [
    ["Total Revenue", toCurrencyValue(sales.totalRevenue)],
    ["Total Orders", toNumber(sales.totalOrders) ?? EMPTY_VALUE],
    ["Total Sales", toNumber(sales.totalSales) ?? EMPTY_VALUE],
    ["Average Order Value", toCurrencyValue(sales.averageOrderValue)],
  ]),
  {
    key: "sales-by-category",
    title: "Sales by Category",
    columns: ["Category Name", "Revenue", "Sales Count"],
    rows: (sales.byCategory || []).map((category) => ({
      "Category Name": toExportCell("Category Name", category.categoryName),
      Revenue: toExportCell("Revenue", toCurrencyValue(category.revenue)),
      "Sales Count": toExportCell(
        "Sales Count",
        toNumber(category.sales) ?? EMPTY_VALUE
      ),
    })),
  },
  {
    key: "sales-top-products",
    title: "Top SKUs by Revenue",
    columns: ["SN No.", "SKU", "Product Name", "Quantity Sold", "Revenue"],
    rows: (sales.topProducts || []).map((product, index) => ({
      "SN No.": index + 1,
      SKU: toExportCell("SKU", toSkuValue((product as any).sku)),
      "Product Name": toExportCell("Product Name", product.productName),
      "Quantity Sold": toExportCell(
        "Quantity Sold",
        toNumber(product.quantity) ?? EMPTY_VALUE
      ),
      Revenue: toExportCell("Revenue", toCurrencyValue(product.revenue)),
    })),
  },
];

const buildUserRetentionSections = (
  userRetention: UserRetentionReport
): ExportSection[] => [
  buildMetricsSection("retention-metrics", "User Retention Metrics", [
    ["Total Users", toNumber(userRetention.totalUsers) ?? EMPTY_VALUE],
    ["Retention Rate (%)", toFixedNumber(userRetention.retentionRate)],
    [
      "Repeat Purchase Rate (%)",
      toFixedNumber(userRetention.repeatPurchaseRate),
    ],
    ["Lifetime Value", toCurrencyValue(userRetention.lifetimeValue)],
  ]),
  {
    key: "retention-top-users",
    title: "Top Users",
    columns: ["SN No.", "User ID", "Name", "Email", "Order Count", "Total Spent"],
    rows: (userRetention.topUsers || []).map((user, index) => ({
      "SN No.": index + 1,
      "User ID": toExportCell("User ID", user.userId),
      Name: toExportCell("Name", user.name),
      Email: toExportCell("Email", user.email),
      "Order Count": toExportCell(
        "Order Count",
        toNumber(user.orderCount) ?? EMPTY_VALUE
      ),
      "Total Spent": toExportCell(
        "Total Spent",
        toCurrencyValue(user.totalSpent)
      ),
    })),
  },
];

const buildOverviewSections = (
  overview: AnalyticsOverview,
  keyPrefix = "overview"
): ExportSection[] => [
  buildMetricsSection(`${keyPrefix}-metrics`, "Overview Metrics", [
    ["Total Revenue", toCurrencyValue(overview.totalRevenue)],
    ["Total Orders", toNumber(overview.totalOrders) ?? EMPTY_VALUE],
    ["Total Sales", toNumber(overview.totalSales) ?? EMPTY_VALUE],
    ["Total Users", toNumber(overview.totalUsers) ?? EMPTY_VALUE],
    ["Average Order Value", toCurrencyValue(overview.averageOrderValue)],
    ["Revenue Change (%)", toFixedNumber(overview.changes?.revenue)],
    ["Orders Change (%)", toFixedNumber(overview.changes?.orders)],
    ["Sales Change (%)", toFixedNumber(overview.changes?.sales)],
    ["Users Change (%)", toFixedNumber(overview.changes?.users)],
    [
      "Average Order Value Change (%)",
      toFixedNumber(overview.changes?.averageOrderValue),
    ],
  ]),
  {
    key: `${keyPrefix}-monthly-trends`,
    title: "Monthly Trends",
    columns: ["Period", "Revenue", "Orders", "Sales", "Users"],
    rows: buildRowsFromSeries(overview.monthlyTrends?.labels, [
      { key: "Revenue", values: overview.monthlyTrends?.revenue || [] },
      { key: "Orders", values: overview.monthlyTrends?.orders || [] },
      { key: "Sales", values: overview.monthlyTrends?.sales || [] },
      { key: "Users", values: overview.monthlyTrends?.users || [] },
    ]),
  },
];

const buildProductPerformanceSection = (
  products: ProductPerformance[]
): ExportSection => ({
  key: "product-performance",
  title: "Product Performance",
  columns: ["SN No.", "SKU", "Product Name", "Quantity Sold", "Revenue"],
  rows: (products || []).map((product, index) => ({
    "SN No.": index + 1,
    SKU: toExportCell(
      "SKU",
      toSkuValue((product as any).sku || (product as any).variantSku)
    ),
    "Product Name": toExportCell("Product Name", product.name),
    "Quantity Sold": toExportCell(
      "Quantity Sold",
      toNumber(product.quantity) ?? EMPTY_VALUE
    ),
    Revenue: toExportCell("Revenue", toCurrencyValue(product.revenue)),
  })),
});

const buildUserAnalyticsSections = (
  users: UserAnalytics,
  keyPrefix = "users"
): ExportSection[] => [
  buildMetricsSection(`${keyPrefix}-metrics`, "User Analytics Metrics", [
    ["Total Users", toNumber(users.totalUsers) ?? EMPTY_VALUE],
    ["Total Revenue", toCurrencyValue(users.totalRevenue)],
    ["Retention Rate (%)", toFixedNumber(users.retentionRate)],
    ["Lifetime Value", toCurrencyValue(users.lifetimeValue)],
    ["Repeat Purchase Rate (%)", toFixedNumber(users.repeatPurchaseRate)],
    ["Engagement Score", toFixedNumber(users.engagementScore)],
    ["Users Change (%)", toFixedNumber(users.changes?.users)],
  ]),
  {
    key: `${keyPrefix}-top-users`,
    title: "Top Users",
    columns: [
      "SN No.",
      "User ID",
      "Name",
      "Email",
      "Order Count",
      "Total Spent",
      "Engagement Score",
    ],
    rows: (users.topUsers || []).map((user, index) => ({
      "SN No.": index + 1,
      "User ID": toExportCell("User ID", (user as any).userId || user.id),
      Name: toExportCell("Name", user.name),
      Email: toExportCell("Email", user.email),
      "Order Count": toExportCell(
        "Order Count",
        toNumber(user.orderCount) ?? EMPTY_VALUE
      ),
      "Total Spent": toExportCell(
        "Total Spent",
        toCurrencyValue(user.totalSpent)
      ),
      "Engagement Score": toExportCell(
        "Engagement Score",
        toFixedNumber(user.engagementScore)
      ),
    })),
  },
  {
    key: `${keyPrefix}-interaction-trends`,
    title: "Interaction Trends",
    columns: ["Period", "Views", "Clicks", "Others"],
    rows: buildRowsFromSeries(users.interactionTrends?.labels, [
      { key: "Views", values: users.interactionTrends?.views || [] },
      { key: "Clicks", values: users.interactionTrends?.clicks || [] },
      { key: "Others", values: users.interactionTrends?.others || [] },
    ]),
  },
];

const sanitizeSection = (section: ExportSection): ExportSection => {
  const blockedColumns = new Set(["categoryid", "category id"]);
  const normalizedRows = section.rows.map((row) => {
    const nextRow: Record<string, unknown> = {};
    section.columns.forEach((column) => {
      const value = Object.prototype.hasOwnProperty.call(row, column)
        ? row[column]
        : EMPTY_VALUE;
      nextRow[column] = normalizeCell(value);
    });
    return nextRow;
  });

  if (!normalizedRows.length) {
    return {
      ...section,
      rows: [],
    };
  }

  const visibleColumns = section.columns.filter(
    (column) => !blockedColumns.has(column.trim().toLowerCase())
  );

  const meaningfulColumns = visibleColumns.filter((column) =>
    normalizedRows.some((row) => row[column] !== EMPTY_VALUE)
  );
  const columnsToUse = meaningfulColumns.length ? meaningfulColumns : visibleColumns;

  return {
    ...section,
    columns: columnsToUse,
    rows: normalizedRows.map((row) =>
      Object.fromEntries(
        columnsToUse.map((column) => [column, row[column] ?? EMPTY_VALUE])
      )
    ),
  };
};

const withNonEmptyRows = (sections: ExportSection[]): ExportSection[] =>
  sections.map((section) => sanitizeSection(section));

const buildDocument = (data: ExportableData | ReportData): ExportDocument => {
  if (isAllReports(data)) {
    return {
      title: "Combined Reports",
      generatedAt: new Date().toISOString(),
      sections: withNonEmptyRows([
        ...buildSalesSections(data.sales),
        ...buildUserRetentionSections(data.userRetention),
      ]),
    };
  }

  if (isSalesReport(data)) {
    return {
      title: "Sales Report",
      generatedAt: new Date().toISOString(),
      sections: withNonEmptyRows(buildSalesSections(data)),
    };
  }

  if (isUserRetentionReport(data)) {
    return {
      title: "User Retention Report",
      generatedAt: new Date().toISOString(),
      sections: withNonEmptyRows(buildUserRetentionSections(data)),
    };
  }

  if (isAllAnalytics(data)) {
    return {
      title: "Analytics Dashboard Export",
      generatedAt: new Date().toISOString(),
      sections: withNonEmptyRows([
        ...buildOverviewSections(data.overview),
        buildProductPerformanceSection(data.products),
        ...buildUserAnalyticsSections(data.users),
      ]),
    };
  }

  if (isAnalyticsOverview(data)) {
    return {
      title: "Analytics Overview Export",
      generatedAt: new Date().toISOString(),
      sections: withNonEmptyRows(buildOverviewSections(data, "single-overview")),
    };
  }

  if (isUserAnalytics(data)) {
    return {
      title: "User Analytics Export",
      generatedAt: new Date().toISOString(),
      sections: withNonEmptyRows(buildUserAnalyticsSections(data, "single-users")),
    };
  }

  if (isProductPerformanceArray(data)) {
    return {
      title: "Product Performance Export",
      generatedAt: new Date().toISOString(),
      sections: [buildProductPerformanceSection(data)],
    };
  }

  return buildFallbackDocument(data);
};

export default function formatAnalyticsData(
  data: ExportableData | ReportData | unknown
): ExportDocument {
  return buildDocument(data as ExportableData | ReportData);
}
