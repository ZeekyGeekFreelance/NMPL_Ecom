import { Context } from "@/modules/product/graphql/resolver";
import mapTransactionStatus from "@/shared/utils/mapTransactionsStatus";
import {
  toAccountReference,
  toOrderReference,
  toTransactionReference,
} from "@/shared/utils/accountReference";

type SearchResult = {
  type: "transaction" | "product" | "category" | "user";
  id: string;
  title: string;
  description?: string;
};

type TransactionRow = {
  id: string;
  orderId: string;
  status: string;
};

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
};

type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
};

const normalizeQuery = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, " ");

const normalizeToken = (value: string): string =>
  value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

const scoreResult = (result: SearchResult, query: string): number => {
  const normalizedQuery = normalizeQuery(query).toLowerCase();
  const normalizedToken = normalizeToken(query);

  const title = normalizeQuery(result.title || "").toLowerCase();
  const description = normalizeQuery(result.description || "").toLowerCase();
  const searchableToken = normalizeToken(
    `${result.title} ${result.description || ""}`
  );

  let score = 0;

  if (title === normalizedQuery) score += 400;
  if (title.startsWith(normalizedQuery)) score += 280;
  if (title.includes(normalizedQuery)) score += 180;
  if (description.includes(normalizedQuery)) score += 120;
  if (normalizedToken && searchableToken.includes(normalizedToken)) score += 210;

  return score;
};

const dedupeByKey = (results: SearchResult[]): SearchResult[] => {
  const seen = new Set<string>();
  const deduped: SearchResult[] = [];

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

export const searchDashboardResolver = {
  Query: {
    searchDashboard: async (
      _: unknown,
      { params }: { params: { searchQuery: string } },
      { prisma }: Context
    ) => {
      const rawQuery = params?.searchQuery || "";
      const searchQuery = normalizeQuery(rawQuery);
      const normalizedToken = normalizeToken(searchQuery);

      if (!searchQuery) {
        return [];
      }

      const validStatuses = mapTransactionStatus(searchQuery);

      const [
        transactionRows,
        referenceTransactionRows,
        productRows,
        categoryRows,
        userRows,
        referenceUserRows,
      ] = await Promise.all([
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
                        in: validStatuses as any,
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
          : Promise.resolve([] as TransactionRow[]),
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
          : Promise.resolve([] as UserRow[]),
      ]);

      const matchedReferenceTransactions = (
        referenceTransactionRows as TransactionRow[]
      ).filter(
        (transaction) =>
          normalizeToken(toTransactionReference(transaction.id)).includes(
            normalizedToken
          ) ||
          normalizeToken(toOrderReference(transaction.orderId)).includes(
            normalizedToken
          )
      );

      const matchedReferenceUsers = (referenceUserRows as UserRow[]).filter(
        (user) =>
          normalizeToken(toAccountReference(user.id)).includes(normalizedToken)
      );

      const transactionResults: SearchResult[] = [
        ...(transactionRows as TransactionRow[]),
        ...matchedReferenceTransactions,
      ].map((transaction) => ({
        type: "transaction",
        id: transaction.id,
        title: toTransactionReference(transaction.id),
        description: `${toOrderReference(transaction.orderId)} - ${transaction.status}`,
      }));

      const productResults: SearchResult[] = (productRows as ProductRow[]).map(
        (product) => ({
          type: "product",
          id: product.id,
          title: product.name,
          description: product.description || "Product",
        })
      );

      const categoryResults: SearchResult[] = (
        categoryRows as CategoryRow[]
      ).map((category) => ({
        type: "category",
        id: category.id,
        title: category.name,
        description: category.description || "Category",
      }));

      const userResults: SearchResult[] = [
        ...(userRows as UserRow[]),
        ...matchedReferenceUsers,
      ].map((user) => ({
        type: "user",
        id: user.id,
        title: `${user.name} (${toAccountReference(user.id)})`,
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
    },
  },
};
