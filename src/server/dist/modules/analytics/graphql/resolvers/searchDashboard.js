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
exports.searchDashboardResolver = void 0;
const mapTransactionsStatus_1 = __importDefault(require("@/shared/utils/mapTransactionsStatus"));
const accountReference_1 = require("@/shared/utils/accountReference");
const normalizeQuery = (value) => value
    .trim()
    .replace(/\s+/g, " ");
const normalizeToken = (value) => value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
const scoreResult = (result, query) => {
    const normalizedQuery = normalizeQuery(query).toLowerCase();
    const normalizedToken = normalizeToken(query);
    const title = normalizeQuery(result.title || "").toLowerCase();
    const description = normalizeQuery(result.description || "").toLowerCase();
    const searchableToken = normalizeToken(`${result.title} ${result.description || ""}`);
    let score = 0;
    if (title === normalizedQuery)
        score += 400;
    if (title.startsWith(normalizedQuery))
        score += 280;
    if (title.includes(normalizedQuery))
        score += 180;
    if (description.includes(normalizedQuery))
        score += 120;
    if (normalizedToken && searchableToken.includes(normalizedToken))
        score += 210;
    return score;
};
const dedupeByKey = (results) => {
    const seen = new Set();
    const deduped = [];
    results.forEach((result) => {
        const key = `${result.type}:${result.id}`;
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        deduped.push(result);
    });
    return deduped;
};
exports.searchDashboardResolver = {
    Query: {
        searchDashboard: (_1, _a, _b) => __awaiter(void 0, [_1, _a, _b], void 0, function* (_, { params }, { prisma }) {
            const rawQuery = (params === null || params === void 0 ? void 0 : params.searchQuery) || "";
            const searchQuery = normalizeQuery(rawQuery);
            const normalizedToken = normalizeToken(searchQuery);
            if (!searchQuery) {
                return [];
            }
            const validStatuses = (0, mapTransactionsStatus_1.default)(searchQuery);
            const [transactionRows, referenceTransactionRows, productRows, categoryRows, userRows, referenceUserRows,] = yield Promise.all([
                prisma.transaction.findMany({
                    where: {
                        OR: [
                            {
                                id: {
                                    contains: searchQuery,
                                    mode: "insensitive",
                                },
                            },
                            {
                                orderId: {
                                    contains: searchQuery,
                                    mode: "insensitive",
                                },
                            },
                            ...(validStatuses.length > 0
                                ? [
                                    {
                                        status: {
                                            in: validStatuses,
                                        },
                                    },
                                ]
                                : []),
                        ],
                    },
                    orderBy: { transactionDate: "desc" },
                    take: 30,
                    select: {
                        id: true,
                        orderId: true,
                        status: true,
                    },
                }),
                normalizedToken.startsWith("TXN") || normalizedToken.startsWith("ORD")
                    ? prisma.transaction.findMany({
                        orderBy: { transactionDate: "desc" },
                        take: 300,
                        select: {
                            id: true,
                            orderId: true,
                            status: true,
                        },
                    })
                    : Promise.resolve([]),
                prisma.product.findMany({
                    where: {
                        OR: [
                            { name: { contains: searchQuery, mode: "insensitive" } },
                            { slug: { contains: searchQuery, mode: "insensitive" } },
                            { description: { contains: searchQuery, mode: "insensitive" } },
                        ],
                    },
                    orderBy: { updatedAt: "desc" },
                    take: 25,
                    select: {
                        id: true,
                        name: true,
                        description: true,
                    },
                }),
                prisma.category.findMany({
                    where: {
                        OR: [
                            { name: { contains: searchQuery, mode: "insensitive" } },
                            { slug: { contains: searchQuery, mode: "insensitive" } },
                            { description: { contains: searchQuery, mode: "insensitive" } },
                        ],
                    },
                    orderBy: { updatedAt: "desc" },
                    take: 20,
                    select: {
                        id: true,
                        name: true,
                        description: true,
                    },
                }),
                prisma.user.findMany({
                    where: {
                        OR: [
                            { id: { contains: searchQuery, mode: "insensitive" } },
                            { name: { contains: searchQuery, mode: "insensitive" } },
                            { email: { contains: searchQuery, mode: "insensitive" } },
                        ],
                    },
                    orderBy: { updatedAt: "desc" },
                    take: 30,
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                }),
                normalizedToken.startsWith("ACC")
                    ? prisma.user.findMany({
                        orderBy: { updatedAt: "desc" },
                        take: 350,
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    })
                    : Promise.resolve([]),
            ]);
            const matchedReferenceTransactions = referenceTransactionRows.filter((transaction) => normalizeToken((0, accountReference_1.toTransactionReference)(transaction.id)).includes(normalizedToken) ||
                normalizeToken((0, accountReference_1.toOrderReference)(transaction.orderId)).includes(normalizedToken));
            const matchedReferenceUsers = referenceUserRows.filter((user) => normalizeToken((0, accountReference_1.toAccountReference)(user.id)).includes(normalizedToken));
            const transactionResults = [
                ...transactionRows,
                ...matchedReferenceTransactions,
            ].map((transaction) => ({
                type: "transaction",
                id: transaction.id,
                title: (0, accountReference_1.toTransactionReference)(transaction.id),
                description: `${(0, accountReference_1.toOrderReference)(transaction.orderId)} - ${transaction.status}`,
            }));
            const productResults = productRows.map((product) => ({
                type: "product",
                id: product.id,
                title: product.name,
                description: product.description || "Product",
            }));
            const categoryResults = categoryRows.map((category) => ({
                type: "category",
                id: category.id,
                title: category.name,
                description: category.description || "Category",
            }));
            const userResults = [
                ...userRows,
                ...matchedReferenceUsers,
            ].map((user) => ({
                type: "user",
                id: user.id,
                title: `${user.name} (${(0, accountReference_1.toAccountReference)(user.id)})`,
                description: user.email,
            }));
            const mergedResults = dedupeByKey([
                ...transactionResults,
                ...productResults,
                ...categoryResults,
                ...userResults,
            ]);
            return mergedResults
                .map((result) => ({ result, score: scoreResult(result, searchQuery) }))
                .filter((item) => item.score > 0)
                .sort((left, right) => right.score - left.score)
                .slice(0, 50)
                .map((item) => item.result);
        }),
    },
};
