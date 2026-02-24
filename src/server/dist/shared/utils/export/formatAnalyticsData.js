"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = formatAnalyticsData;
const EMPTY_VALUE = "";
const isPrimitive = (value) => typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean";
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
const buildMetricsSection = (key, title, metrics) => ({
    key,
    title,
    columns: ["Metric", "Value"],
    rows: metrics.map(([metric, value]) => ({
        Metric: metric,
        Value: normalizeCell(value),
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
                    : normalizeCell(item.values[index]);
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
                    : normalizeCell(row[originalColumn]);
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
            ["Total Revenue", toFixedNumber(sales.totalRevenue)],
            ["Total Orders", (_a = toNumber(sales.totalOrders)) !== null && _a !== void 0 ? _a : EMPTY_VALUE],
            ["Total Sales", (_b = toNumber(sales.totalSales)) !== null && _b !== void 0 ? _b : EMPTY_VALUE],
            ["Average Order Value", toFixedNumber(sales.averageOrderValue)],
        ]),
        {
            key: "sales-by-category",
            title: "Sales by Category",
            columns: ["Category ID", "Category Name", "Revenue", "Sales Count"],
            rows: (sales.byCategory || []).map((category) => {
                var _a;
                return ({
                    "Category ID": normalizeCell(category.categoryId),
                    "Category Name": normalizeCell(category.categoryName),
                    Revenue: toFixedNumber(category.revenue),
                    "Sales Count": (_a = toNumber(category.sales)) !== null && _a !== void 0 ? _a : EMPTY_VALUE,
                });
            }),
        },
        {
            key: "sales-top-products",
            title: "Top Products by Revenue",
            columns: [
                "Rank",
                "Product ID",
                "Product Name",
                "Quantity Sold",
                "Revenue",
            ],
            rows: (sales.topProducts || []).map((product, index) => {
                var _a;
                return ({
                    Rank: index + 1,
                    "Product ID": normalizeCell(product.productId),
                    "Product Name": normalizeCell(product.productName),
                    "Quantity Sold": (_a = toNumber(product.quantity)) !== null && _a !== void 0 ? _a : EMPTY_VALUE,
                    Revenue: toFixedNumber(product.revenue),
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
            ["Lifetime Value", toFixedNumber(userRetention.lifetimeValue)],
        ]),
        {
            key: "retention-top-users",
            title: "Top Users",
            columns: [
                "Rank",
                "User ID",
                "Name",
                "Email",
                "Order Count",
                "Total Spent",
            ],
            rows: (userRetention.topUsers || []).map((user, index) => {
                var _a;
                return ({
                    Rank: index + 1,
                    "User ID": normalizeCell(user.userId),
                    Name: normalizeCell(user.name),
                    Email: normalizeCell(user.email),
                    "Order Count": (_a = toNumber(user.orderCount)) !== null && _a !== void 0 ? _a : EMPTY_VALUE,
                    "Total Spent": toFixedNumber(user.totalSpent),
                });
            }),
        },
    ];
};
const buildOverviewSections = (overview, keyPrefix = "overview") => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    return [
        buildMetricsSection(`${keyPrefix}-metrics`, "Overview Metrics", [
            ["Total Revenue", toFixedNumber(overview.totalRevenue)],
            ["Total Orders", (_a = toNumber(overview.totalOrders)) !== null && _a !== void 0 ? _a : EMPTY_VALUE],
            ["Total Sales", (_b = toNumber(overview.totalSales)) !== null && _b !== void 0 ? _b : EMPTY_VALUE],
            ["Total Users", (_c = toNumber(overview.totalUsers)) !== null && _c !== void 0 ? _c : EMPTY_VALUE],
            ["Average Order Value", toFixedNumber(overview.averageOrderValue)],
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
    columns: ["Rank", "Product ID", "Product Name", "Quantity Sold", "Revenue"],
    rows: (products || []).map((product, index) => {
        var _a;
        return ({
            Rank: index + 1,
            "Product ID": normalizeCell(product.productId || product.id),
            "Product Name": normalizeCell(product.name),
            "Quantity Sold": (_a = toNumber(product.quantity)) !== null && _a !== void 0 ? _a : EMPTY_VALUE,
            Revenue: toFixedNumber(product.revenue),
        });
    }),
});
const buildUserAnalyticsSections = (users, keyPrefix = "users") => {
    var _a, _b, _c, _d, _e, _f;
    return [
        buildMetricsSection(`${keyPrefix}-metrics`, "User Analytics Metrics", [
            ["Total Users", (_a = toNumber(users.totalUsers)) !== null && _a !== void 0 ? _a : EMPTY_VALUE],
            ["Total Revenue", toFixedNumber(users.totalRevenue)],
            ["Retention Rate (%)", toFixedNumber(users.retentionRate)],
            ["Lifetime Value", toFixedNumber(users.lifetimeValue)],
            ["Repeat Purchase Rate (%)", toFixedNumber(users.repeatPurchaseRate)],
            ["Engagement Score", toFixedNumber(users.engagementScore)],
            ["Users Change (%)", toFixedNumber((_b = users.changes) === null || _b === void 0 ? void 0 : _b.users)],
        ]),
        {
            key: `${keyPrefix}-top-users`,
            title: "Top Users",
            columns: [
                "Rank",
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
                    Rank: index + 1,
                    "User ID": normalizeCell(user.userId || user.id),
                    Name: normalizeCell(user.name),
                    Email: normalizeCell(user.email),
                    "Order Count": (_a = toNumber(user.orderCount)) !== null && _a !== void 0 ? _a : EMPTY_VALUE,
                    "Total Spent": toFixedNumber(user.totalSpent),
                    "Engagement Score": toFixedNumber(user.engagementScore),
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
const withNonEmptyRows = (sections) => sections.map((section) => (Object.assign(Object.assign({}, section), { rows: section.rows.length > 0 ? section.rows : [] })));
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
