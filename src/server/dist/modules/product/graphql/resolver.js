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
exports.productResolvers = void 0;
const AppError_1 = __importDefault(require("@/shared/errors/AppError"));
const client_1 = require("@prisma/client");
const isDealerTableMissing = (error) => {
    if (!(error instanceof Error)) {
        return false;
    }
    return (error.message.includes('relation "DealerProfile" does not exist') ||
        error.message.includes('relation "DealerPriceMapping" does not exist'));
};
const getDealerPriceMap = (prisma, userId, variantIds) => __awaiter(void 0, void 0, void 0, function* () {
    if (!userId || !variantIds.length) {
        return new Map();
    }
    try {
        const dealerProfile = yield prisma.$queryRaw(client_1.Prisma.sql `
        SELECT "status"
        FROM "DealerProfile"
        WHERE "userId" = ${userId}
        LIMIT 1
      `);
        if (!dealerProfile.length || dealerProfile[0].status !== "APPROVED") {
            return new Map();
        }
        const dealerPrices = yield prisma.$queryRaw(client_1.Prisma.sql `
        SELECT "variantId", "customPrice"
        FROM "DealerPriceMapping"
        WHERE "dealerId" = ${userId}
          AND "variantId" IN (${client_1.Prisma.join(variantIds)})
      `);
        return new Map(dealerPrices.map((dealerPrice) => [
            dealerPrice.variantId,
            dealerPrice.customPrice,
        ]));
    }
    catch (error) {
        if (isDealerTableMissing(error)) {
            return new Map();
        }
        throw error;
    }
});
const applyDealerPricingToProducts = (context, products) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!products.length) {
        return products;
    }
    const userId = (_a = context.req.user) === null || _a === void 0 ? void 0 : _a.id;
    const variantIds = products.flatMap((product) => Array.isArray(product === null || product === void 0 ? void 0 : product.variants)
        ? product.variants.map((variant) => variant.id)
        : []);
    const dealerPriceMap = yield getDealerPriceMap(context.prisma, userId, variantIds);
    if (!dealerPriceMap.size) {
        return products;
    }
    return products.map((product) => (Object.assign(Object.assign({}, product), { variants: Array.isArray(product === null || product === void 0 ? void 0 : product.variants)
            ? product.variants.map((variant) => {
                var _a;
                return (Object.assign(Object.assign({}, variant), { price: (_a = dealerPriceMap.get(variant.id)) !== null && _a !== void 0 ? _a : variant.price }));
            })
            : product.variants })));
});
const applyDealerPricingToProduct = (context, product) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!product) {
        return product;
    }
    const pricedProducts = yield applyDealerPricingToProducts(context, [product]);
    return (_a = pricedProducts[0]) !== null && _a !== void 0 ? _a : product;
});
exports.productResolvers = {
    Query: {
        products: (_1, _a, context_1) => __awaiter(void 0, [_1, _a, context_1], void 0, function* (_, { first = 10, skip = 0, filters = {}, }, context) {
            var _b;
            const where = {};
            // Search filter
            const searchQuery = (_b = filters.search) === null || _b === void 0 ? void 0 : _b.trim();
            if (searchQuery) {
                where.OR = [
                    { name: { contains: searchQuery, mode: "insensitive" } },
                    { description: { contains: searchQuery, mode: "insensitive" } },
                    {
                        category: {
                            is: {
                                name: { contains: searchQuery, mode: "insensitive" },
                            },
                        },
                    },
                    {
                        variants: {
                            some: {
                                sku: { contains: searchQuery, mode: "insensitive" },
                            },
                        },
                    },
                ];
            }
            // Flag filters
            if (filters.isNew !== undefined)
                where.isNew = filters.isNew;
            if (filters.isFeatured !== undefined)
                where.isFeatured = filters.isFeatured;
            if (filters.isTrending !== undefined)
                where.isTrending = filters.isTrending;
            if (filters.isBestSeller !== undefined)
                where.isBestSeller = filters.isBestSeller;
            // ✅ OR logic for multiple flags
            if (filters.flags && filters.flags.length > 0) {
                const flagConditions = filters.flags.map((flag) => ({ [flag]: true }));
                if (!where.OR)
                    where.OR = [];
                where.OR = [...where.OR, ...flagConditions];
            }
            // Category filter
            if (filters.categoryId) {
                where.categoryId = filters.categoryId;
            }
            // Price filter (based on variants)
            if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
                where.variants = {
                    some: {
                        price: Object.assign(Object.assign({}, (filters.minPrice !== undefined && { gte: filters.minPrice })), (filters.maxPrice !== undefined && { lte: filters.maxPrice })),
                    },
                };
            }
            const totalCount = yield context.prisma.product.count({ where });
            const products = yield context.prisma.product.findMany({
                where,
                take: first,
                skip,
                include: {
                    category: true,
                    variants: true,
                    reviews: true,
                },
            });
            const pricedProducts = yield applyDealerPricingToProducts(context, products);
            return {
                products: pricedProducts,
                hasMore: skip + products.length < totalCount,
                totalCount,
            };
        }),
        product: (_1, _a, context_1) => __awaiter(void 0, [_1, _a, context_1], void 0, function* (_, { slug }, context) {
            const product = yield context.prisma.product.findUnique({
                where: { slug },
                include: {
                    category: true,
                    variants: {
                        include: {
                            attributes: {
                                include: {
                                    attribute: true,
                                    value: true,
                                },
                            },
                        },
                    },
                    reviews: true,
                },
            });
            if (!product) {
                throw new AppError_1.default(404, "Product not found");
            }
            return applyDealerPricingToProduct(context, product);
        }),
        newProducts: (_1, _a, context_1) => __awaiter(void 0, [_1, _a, context_1], void 0, function* (_, { first = 10, skip = 0 }, context) {
            const totalCount = yield context.prisma.product.count({
                where: { isNew: true },
            });
            const products = yield context.prisma.product.findMany({
                where: { isNew: true },
                take: first,
                skip,
                include: {
                    category: true,
                    variants: true,
                    reviews: true,
                },
            });
            const pricedProducts = yield applyDealerPricingToProducts(context, products);
            return {
                products: pricedProducts,
                hasMore: skip + products.length < totalCount,
                totalCount,
            };
        }),
        featuredProducts: (_1, _a, context_1) => __awaiter(void 0, [_1, _a, context_1], void 0, function* (_, { first = 10, skip = 0 }, context) {
            const totalCount = yield context.prisma.product.count({
                where: { isFeatured: true },
            });
            const products = yield context.prisma.product.findMany({
                where: { isFeatured: true },
                take: first,
                skip,
                include: {
                    category: true,
                    variants: true,
                    reviews: true,
                },
            });
            const pricedProducts = yield applyDealerPricingToProducts(context, products);
            return {
                products: pricedProducts,
                hasMore: skip + products.length < totalCount,
                totalCount,
            };
        }),
        trendingProducts: (_1, _a, context_1) => __awaiter(void 0, [_1, _a, context_1], void 0, function* (_, { first = 10, skip = 0 }, context) {
            const totalCount = yield context.prisma.product.count({
                where: { isTrending: true },
            });
            const products = yield context.prisma.product.findMany({
                where: { isTrending: true },
                take: first,
                skip,
                include: {
                    category: true,
                    variants: true,
                    reviews: true,
                },
            });
            const pricedProducts = yield applyDealerPricingToProducts(context, products);
            return {
                products: pricedProducts,
                hasMore: skip + products.length < totalCount,
                totalCount,
            };
        }),
        bestSellerProducts: (_1, _a, context_1) => __awaiter(void 0, [_1, _a, context_1], void 0, function* (_, { first = 10, skip = 0 }, context) {
            const totalCount = yield context.prisma.product.count({
                where: { isBestSeller: true },
            });
            const products = yield context.prisma.product.findMany({
                where: { isBestSeller: true },
                take: first,
                skip,
                include: {
                    category: true,
                    variants: true,
                    reviews: true,
                },
            });
            const pricedProducts = yield applyDealerPricingToProducts(context, products);
            return {
                products: pricedProducts,
                hasMore: skip + products.length < totalCount,
                totalCount,
            };
        }),
        categories: (_, __, context) => __awaiter(void 0, void 0, void 0, function* () {
            return context.prisma.category.findMany({
                include: {
                    products: {
                        include: {
                            variants: true,
                        },
                    },
                },
            });
        }),
    },
    Product: {
        reviews: (parent, _, context) => {
            return context.prisma.review.findMany({
                where: { productId: parent.id },
                include: {
                    user: true,
                },
            });
        },
    },
};
