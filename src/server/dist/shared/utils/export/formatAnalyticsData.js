"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = formatAnalyticsData;
const accountReference_1 = require("@/shared/utils/accountReference");
const EMPTY_VALUE = "";
const FALLBACK_SKU_VALUE = "N/A";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CURRENCY_FORMATTER = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
const isPrimitive = (value) => typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean";
const normalizeRoleValue = (value) => {
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
const toReferenceValue = (key, value) => {
    if (typeof value !== "string") {
        return value;
    }
    const raw = value.trim();
    if (!UUID_PATTERN.test(raw)) {
        return value;
    }
    const normalizedKey = key.replace(/\s+/g, "").toLowerCase();
    if (normalizedKey.includes("orderid")) {
        return (0, accountReference_1.toOrderReference)(raw);
    }
    if (normalizedKey.includes("paymentid")) {
        return (0, accountReference_1.toPaymentReference)(raw);
    }
    if (normalizedKey.includes("transactionid")) {
        return (0, accountReference_1.toTransactionReference)(raw);
    }
    if (normalizedKey.includes("userid") || normalizedKey.includes("accountid")) {
        return (0, accountReference_1.toAccountReference)(raw);
    }
    if (normalizedKey.includes("productid")) {
        return (0, accountReference_1.toProductReference)(raw);
    }
    return value;
};
const toExportCell = (key, value) => {
    const normalizedKey = key.replace(/\s+/g, "").toLowerCase();
    const roleKey = normalizedKey.includes("role") || normalizedKey.includes("customertype");
    if (roleKey) {
        return normalizeCell(normalizeRoleValue(value));
    }
    return normalizeCell(toReferenceValue(key, value));
};
const normalizeCell = (value) => {
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
        return Object.entries(value)
            .map(([key, nestedValue]) => {
            const nextValue = normalizeCell(nestedValue);
            return nextValue === EMPTY_VALUE ? "" : `${key}: ${nextValue}`;
        })
            .filter(Boolean)
            .join("; ");
    }
    return String(value);
};
const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};
const toFixedNumber = (value, digits = 2) => {
    const parsed = toNumber(value);
    return parsed === null ? EMPTY_VALUE : Number(parsed.toFixed(digits));
};
const toCurrencyValue = (value) => {
    const parsed = toNumber(value);
    return parsed === null ? EMPTY_VALUE : CURRENCY_FORMATTER.format(parsed);
};
const toSkuValue = (value) => {
    if (typeof value !== "string") {
        return FALLBACK_SKU_VALUE;
    }
    const normalized = value.trim();
    return normalized || FALLBACK_SKU_VALUE;
};
const buildMetricsSection = (key, title, metrics) => ({
    key,
    title,
    columns: ["Metric", "Value"],
    rows: metrics.map(([metric, value]) => ({
        Metric: metric,
        Value: toExportCell(metric, value),
    })),
});
const buildRowsFromSeries = (labels = [], series) => {
    const maxLength = Math.max(labels.length, ...series.map((item) => item.values.length), 0);
    return Array.from({ length: maxLength }, (_, index) => {
        const row = {
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
const flattenRecord = (value, prefix = "", output = {}) => {
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
        const everyPrimitive = value.every((item) => item === null || item === undefined || isPrimitive(item));
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
    const entries = Object.entries(value);
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
const titleCaseKey = (value) => value
    .split(".")
    .map((part) => part
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/^./, (char) => char.toUpperCase());
const buildFallbackDocument = (data) => {
    const rows = Array.isArray(data)
        ? data.map((item) => flattenRecord(item))
        : [flattenRecord(data)];
    const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).map((column) => titleCaseKey(column));
    const normalizedRows = rows.map((row) => {
        const mappedRow = {};
        columns.forEach((column) => {
            const originalColumn = Object.keys(row).find((key) => titleCaseKey(key) === column);
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
const isAllAnalytics = (data) => !!data &&
    typeof data === "object" &&
    "overview" in data &&
    "products" in data &&
    "users" in data;
const isAnalyticsOverview = (data) => !!data &&
    typeof data === "object" &&
    "monthlyTrends" in data &&
    "totalOrders" in data &&
    "averageOrderValue" in data;
const isUserAnalytics = (data) => !!data &&
    typeof data === "object" &&
    "interactionTrends" in data &&
    "topUsers" in data &&
    "engagementScore" in data;
const isProductPerformanceArray = (data) => Array.isArray(data) &&
    data.every((item) => item &&
        typeof item === "object" &&
        "id" in item &&
        "name" in item);
const isAllReports = (data) => !!data &&
    typeof data === "object" &&
    "sales" in data &&
    "userRetention" in data;
const isSalesReport = (data) => !!data &&
    typeof data === "object" &&
    "byCategory" in data &&
    "topProducts" in data &&
    "totalRevenue" in data;
const isUserRetentionReport = (data) => !!data &&
    typeof data === "object" &&
    "topUsers" in data &&
    "retentionRate" in data &&
    "lifetimeValue" in data;
const buildSalesSections = (sales) => {
    var _a, _b;
    return [
        buildMetricsSection("sales-metrics", "Sales Metrics", [
            ["Total Revenue", toCurrencyValue(sales.totalRevenue)],
            ["Total Orders", (_a = toNumber(sales.totalOrders)) !== null && _a !== void 0 ? _a : EMPTY_VALUE],
            ["Total Sales", (_b = toNumber(sales.totalSales)) !== null && _b !== void 0 ? _b : EMPTY_VALUE],
            ["Average Order Value", toCurrencyValue(sales.averageOrderValue)],
        ]),
        {
            key: "sales-by-category",
            title: "Sales by Category",
            columns: ["Category ID", "Category Name", "Revenue", "Sales Count"],
            rows: (sales.byCategory || []).map((category) => {
                var _a;
                return ({
                    "Category ID": toExportCell("Category ID", category.categoryId),
                    "Category Name": toExportCell("Category Name", category.categoryName),
                    Revenue: toExportCell("Revenue", toCurrencyValue(category.revenue)),
                    "Sales Count": toExportCell("Sales Count", (_a = toNumber(category.sales)) !== null && _a !== void 0 ? _a : EMPTY_VALUE),
                });
            }),
        },
        {
            key: "sales-top-products",
            title: "Top SKUs by Revenue",
            columns: ["SN No.", "SKU", "Product Name", "Quantity Sold", "Revenue"],
            rows: (sales.topProducts || []).map((product, index) => {
                var _a;
                return ({
                    "SN No.": index + 1,
                    SKU: toExportCell("SKU", toSkuValue(product.sku)),
                    "Product Name": toExportCell("Product Name", product.productName),
                    "Quantity Sold": toExportCell("Quantity Sold", (_a = toNumber(product.quantity)) !== null && _a !== void 0 ? _a : EMPTY_VALUE),
                    Revenue: toExportCell("Revenue", toCurrencyValue(product.revenue)),
                });
            }),
        },
    ];
};
const buildUserRetentionSections = (userRetention) => {
    var _a;
    return [
        buildMetricsSection("retention-metrics", "User Retention Metrics", [
            ["Total Users", (_a = toNumber(userRetention.totalUsers)) !== null && _a !== void 0 ? _a : EMPTY_VALUE],
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
            rows: (userRetention.topUsers || []).map((user, index) => {
                var _a;
                return ({
                    "SN No.": index + 1,
                    "User ID": toExportCell("User ID", user.userId),
                    Name: toExportCell("Name", user.name),
                    Email: toExportCell("Email", user.email),
                    "Order Count": toExportCell("Order Count", (_a = toNumber(user.orderCount)) !== null && _a !== void 0 ? _a : EMPTY_VALUE),
                    "Total Spent": toExportCell("Total Spent", toCurrencyValue(user.totalSpent)),
                });
            }),
        },
    ];
};
const buildOverviewSections = (overview, keyPrefix = "overview") => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    return [
        buildMetricsSection(`${keyPrefix}-metrics`, "Overview Metrics", [
            ["Total Revenue", toCurrencyValue(overview.totalRevenue)],
            ["Total Orders", (_a = toNumber(overview.totalOrders)) !== null && _a !== void 0 ? _a : EMPTY_VALUE],
            ["Total Sales", (_b = toNumber(overview.totalSales)) !== null && _b !== void 0 ? _b : EMPTY_VALUE],
            ["Total Users", (_c = toNumber(overview.totalUsers)) !== null && _c !== void 0 ? _c : EMPTY_VALUE],
            ["Average Order Value", toCurrencyValue(overview.averageOrderValue)],
            ["Revenue Change (%)", toFixedNumber((_d = overview.changes) === null || _d === void 0 ? void 0 : _d.revenue)],
            ["Orders Change (%)", toFixedNumber((_e = overview.changes) === null || _e === void 0 ? void 0 : _e.orders)],
            ["Sales Change (%)", toFixedNumber((_f = overview.changes) === null || _f === void 0 ? void 0 : _f.sales)],
            ["Users Change (%)", toFixedNumber((_g = overview.changes) === null || _g === void 0 ? void 0 : _g.users)],
            [
                "Average Order Value Change (%)",
                toFixedNumber((_h = overview.changes) === null || _h === void 0 ? void 0 : _h.averageOrderValue),
            ],
        ]),
        {
            key: `${keyPrefix}-monthly-trends`,
            title: "Monthly Trends",
            columns: ["Period", "Revenue", "Orders", "Sales", "Users"],
            rows: buildRowsFromSeries((_j = overview.monthlyTrends) === null || _j === void 0 ? void 0 : _j.labels, [
                { key: "Revenue", values: ((_k = overview.monthlyTrends) === null || _k === void 0 ? void 0 : _k.revenue) || [] },
                { key: "Orders", values: ((_l = overview.monthlyTrends) === null || _l === void 0 ? void 0 : _l.orders) || [] },
                { key: "Sales", values: ((_m = overview.monthlyTrends) === null || _m === void 0 ? void 0 : _m.sales) || [] },
                { key: "Users", values: ((_o = overview.monthlyTrends) === null || _o === void 0 ? void 0 : _o.users) || [] },
            ]),
        },
    ];
};
const buildProductPerformanceSection = (products) => ({
    key: "product-performance",
    title: "Product Performance",
    columns: ["SN No.", "SKU", "Product Name", "Quantity Sold", "Revenue"],
    rows: (products || []).map((product, index) => {
        var _a;
        return ({
            "SN No.": index + 1,
            SKU: toExportCell("SKU", toSkuValue(product.sku || product.variantSku)),
            "Product Name": toExportCell("Product Name", product.name),
            "Quantity Sold": toExportCell("Quantity Sold", (_a = toNumber(product.quantity)) !== null && _a !== void 0 ? _a : EMPTY_VALUE),
            Revenue: toExportCell("Revenue", toCurrencyValue(product.revenue)),
        });
    }),
});
const buildUserAnalyticsSections = (users, keyPrefix = "users") => {
    var _a, _b, _c, _d, _e, _f;
    return [
        buildMetricsSection(`${keyPrefix}-metrics`, "User Analytics Metrics", [
            ["Total Users", (_a = toNumber(users.totalUsers)) !== null && _a !== void 0 ? _a : EMPTY_VALUE],
            ["Total Revenue", toCurrencyValue(users.totalRevenue)],
            ["Retention Rate (%)", toFixedNumber(users.retentionRate)],
            ["Lifetime Value", toCurrencyValue(users.lifetimeValue)],
            ["Repeat Purchase Rate (%)", toFixedNumber(users.repeatPurchaseRate)],
            ["Engagement Score", toFixedNumber(users.engagementScore)],
            ["Users Change (%)", toFixedNumber((_b = users.changes) === null || _b === void 0 ? void 0 : _b.users)],
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
            rows: (users.topUsers || []).map((user, index) => {
                var _a;
                return ({
                    "SN No.": index + 1,
                    "User ID": toExportCell("User ID", user.userId || user.id),
                    Name: toExportCell("Name", user.name),
                    Email: toExportCell("Email", user.email),
                    "Order Count": toExportCell("Order Count", (_a = toNumber(user.orderCount)) !== null && _a !== void 0 ? _a : EMPTY_VALUE),
                    "Total Spent": toExportCell("Total Spent", toCurrencyValue(user.totalSpent)),
                    "Engagement Score": toExportCell("Engagement Score", toFixedNumber(user.engagementScore)),
                });
            }),
        },
        {
            key: `${keyPrefix}-interaction-trends`,
            title: "Interaction Trends",
            columns: ["Period", "Views", "Clicks", "Others"],
            rows: buildRowsFromSeries((_c = users.interactionTrends) === null || _c === void 0 ? void 0 : _c.labels, [
                { key: "Views", values: ((_d = users.interactionTrends) === null || _d === void 0 ? void 0 : _d.views) || [] },
                { key: "Clicks", values: ((_e = users.interactionTrends) === null || _e === void 0 ? void 0 : _e.clicks) || [] },
                { key: "Others", values: ((_f = users.interactionTrends) === null || _f === void 0 ? void 0 : _f.others) || [] },
            ]),
        },
    ];
};
const sanitizeSection = (section) => {
    const normalizedRows = section.rows.map((row) => {
        const nextRow = {};
        section.columns.forEach((column) => {
            const value = Object.prototype.hasOwnProperty.call(row, column)
                ? row[column]
                : EMPTY_VALUE;
            nextRow[column] = normalizeCell(value);
        });
        return nextRow;
    });
    if (!normalizedRows.length) {
        return Object.assign(Object.assign({}, section), { rows: [] });
    }
    const meaningfulColumns = section.columns.filter((column) => normalizedRows.some((row) => row[column] !== EMPTY_VALUE));
    const columnsToUse = meaningfulColumns.length
        ? meaningfulColumns
        : section.columns;
    return Object.assign(Object.assign({}, section), { columns: columnsToUse, rows: normalizedRows.map((row) => Object.fromEntries(columnsToUse.map((column) => { var _a; return [column, (_a = row[column]) !== null && _a !== void 0 ? _a : EMPTY_VALUE]; }))) });
};
const withNonEmptyRows = (sections) => sections.map((section) => sanitizeSection(section));
const buildDocument = (data) => {
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
function formatAnalyticsData(data) {
    return buildDocument(data);
}
