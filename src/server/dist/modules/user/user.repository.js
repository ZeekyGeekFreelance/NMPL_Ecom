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
exports.UserRepository = void 0;
const database_config_1 = __importDefault(require("@/infra/database/database.config"));
const client_1 = require("@prisma/client");
const authUtils_1 = require("@/shared/utils/authUtils");
const AppError_1 = __importDefault(require("@/shared/errors/AppError"));
const crypto_1 = __importDefault(require("crypto"));
class UserRepository {
    isDealerTableMissing(error) {
        if (!(error instanceof Error)) {
            return false;
        }
        return (error.message.includes('relation "DealerProfile" does not exist') ||
            error.message.includes('relation "DealerPriceMapping" does not exist'));
    }
    throwDealerMigrationError() {
        throw new AppError_1.default(503, "Dealer tables are not available. Run Prisma migrations before using dealer features.");
    }
    findDealerProfilesByUserIds(userIds) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!userIds.length) {
                return [];
            }
            try {
                return yield database_config_1.default.$queryRaw(client_1.Prisma.sql `
          SELECT
            "id",
            "userId",
            "businessName",
            "contactPhone",
            "status",
            "approvedAt",
            "approvedBy",
            "createdAt",
            "updatedAt"
          FROM "DealerProfile"
          WHERE "userId" IN (${client_1.Prisma.join(userIds)})
        `);
            }
            catch (error) {
                if (this.isDealerTableMissing(error)) {
                    return [];
                }
                throw error;
            }
        });
    }
    findAllUsers() {
        return __awaiter(this, void 0, void 0, function* () {
            const users = yield database_config_1.default.user.findMany({
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    avatar: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });
            const dealerProfiles = yield this.findDealerProfilesByUserIds(users.map((user) => user.id));
            const dealerProfilesByUserId = new Map(dealerProfiles.map((profile) => [profile.userId, profile]));
            return users.map((user) => {
                var _a;
                return (Object.assign(Object.assign({}, user), { dealerProfile: (_a = dealerProfilesByUserId.get(user.id)) !== null && _a !== void 0 ? _a : null }));
            });
        });
    }
    findUserById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!id) {
                return null;
            }
            const user = yield database_config_1.default.user.findUnique({
                where: { id },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    avatar: true,
                    role: true,
                },
            });
            if (!user) {
                return null;
            }
            const dealerProfile = yield this.findDealerProfileByUserId(user.id);
            return Object.assign(Object.assign({}, user), { dealerProfile });
        });
    }
    findUserByEmail(email) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield database_config_1.default.user.findFirst({
                where: {
                    email: {
                        equals: email,
                        mode: "insensitive",
                    },
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    avatar: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });
        });
    }
    updateUser(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield database_config_1.default.user.update({ where: { id }, data });
        });
    }
    deleteUser(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield database_config_1.default.user.delete({ where: { id } });
        });
    }
    countUsersByRole(role) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield database_config_1.default.user.count({
                where: { role: role },
            });
        });
    }
    countValidVariants(variantIds) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!variantIds.length) {
                return 0;
            }
            return database_config_1.default.productVariant.count({
                where: {
                    id: {
                        in: variantIds,
                    },
                },
            });
        });
    }
    createUser(data) {
        return __awaiter(this, void 0, void 0, function* () {
            // Hash the password before storing
            const hashedPassword = yield authUtils_1.passwordUtils.hashPassword(data.password);
            return yield database_config_1.default.user.create({
                data: Object.assign(Object.assign({}, data), { password: hashedPassword, role: data.role }),
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    role: true,
                    avatar: true,
                },
            });
        });
    }
    findDealerProfileByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const rows = yield database_config_1.default.$queryRaw(client_1.Prisma.sql `
          SELECT
            "id",
            "userId",
            "businessName",
            "contactPhone",
            "status",
            "approvedAt",
            "approvedBy",
            "createdAt",
            "updatedAt"
          FROM "DealerProfile"
          WHERE "userId" = ${userId}
          LIMIT 1
        `);
                return (_a = rows[0]) !== null && _a !== void 0 ? _a : null;
            }
            catch (error) {
                if (this.isDealerTableMissing(error)) {
                    return null;
                }
                throw error;
            }
        });
    }
    upsertDealerProfile(data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const now = new Date();
            const approvedAt = data.status === "APPROVED" ? now : null;
            try {
                yield database_config_1.default.$executeRaw(client_1.Prisma.sql `
          INSERT INTO "DealerProfile" (
            "id",
            "userId",
            "businessName",
            "contactPhone",
            "status",
            "approvedAt",
            "approvedBy",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            ${crypto_1.default.randomUUID()},
            ${data.userId},
            ${(_a = data.businessName) !== null && _a !== void 0 ? _a : null},
            ${(_b = data.contactPhone) !== null && _b !== void 0 ? _b : null},
            ${data.status},
            ${approvedAt},
            ${(_c = data.approvedBy) !== null && _c !== void 0 ? _c : null},
            ${now},
            ${now}
          )
          ON CONFLICT ("userId")
          DO UPDATE SET
            "businessName" = COALESCE(EXCLUDED."businessName", "DealerProfile"."businessName"),
            "contactPhone" = COALESCE(EXCLUDED."contactPhone", "DealerProfile"."contactPhone"),
            "status" = EXCLUDED."status",
            "approvedAt" = EXCLUDED."approvedAt",
            "approvedBy" = EXCLUDED."approvedBy",
            "updatedAt" = EXCLUDED."updatedAt"
        `);
            }
            catch (error) {
                if (this.isDealerTableMissing(error)) {
                    this.throwDealerMigrationError();
                }
                throw error;
            }
            return this.findDealerProfileByUserId(data.userId);
        });
    }
    getDealers(status) {
        return __awaiter(this, void 0, void 0, function* () {
            const statusFilter = status
                ? client_1.Prisma.sql `WHERE dp."status" = ${status}`
                : client_1.Prisma.empty;
            try {
                return database_config_1.default.$queryRaw(client_1.Prisma.sql `
          SELECT
            u."id",
            u."name",
            u."email",
            u."role",
            u."avatar",
            u."createdAt",
            u."updatedAt",
            dp."id" AS "dealerProfileId",
            dp."businessName",
            dp."contactPhone",
            dp."status",
            dp."approvedAt",
            dp."approvedBy",
            dp."createdAt" AS "dealerCreatedAt",
            dp."updatedAt" AS "dealerUpdatedAt"
          FROM "User" u
          INNER JOIN "DealerProfile" dp ON dp."userId" = u."id"
          ${statusFilter}
          ORDER BY dp."updatedAt" DESC
        `);
            }
            catch (error) {
                if (this.isDealerTableMissing(error)) {
                    return [];
                }
                throw error;
            }
        });
    }
    updateDealerStatus(userId, status, approvedBy) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            const approvedAt = status === "APPROVED" ? now : null;
            try {
                yield database_config_1.default.$executeRaw(client_1.Prisma.sql `
          UPDATE "DealerProfile"
          SET
            "status" = ${status},
            "approvedAt" = ${approvedAt},
            "approvedBy" = ${status === "APPROVED" ? approvedBy !== null && approvedBy !== void 0 ? approvedBy : null : null},
            "updatedAt" = ${now}
          WHERE "userId" = ${userId}
        `);
            }
            catch (error) {
                if (this.isDealerTableMissing(error)) {
                    this.throwDealerMigrationError();
                }
                throw error;
            }
            return this.findDealerProfileByUserId(userId);
        });
    }
    setDealerPrices(dealerId, prices) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield database_config_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                    yield tx.$executeRaw(client_1.Prisma.sql `DELETE FROM "DealerPriceMapping" WHERE "dealerId" = ${dealerId}`);
                    if (!prices.length) {
                        return;
                    }
                    const now = new Date();
                    for (const price of prices) {
                        yield tx.$executeRaw(client_1.Prisma.sql `
              INSERT INTO "DealerPriceMapping" (
                "id",
                "dealerId",
                "variantId",
                "customPrice",
                "createdAt",
                "updatedAt"
              )
              VALUES (
                ${crypto_1.default.randomUUID()},
                ${dealerId},
                ${price.variantId},
                ${price.customPrice},
                ${now},
                ${now}
              )
            `);
                    }
                }));
            }
            catch (error) {
                if (this.isDealerTableMissing(error)) {
                    this.throwDealerMigrationError();
                }
                throw error;
            }
            return this.getDealerPrices(dealerId);
        });
    }
    getDealerPrices(dealerId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield database_config_1.default.$queryRaw(client_1.Prisma.sql `
          SELECT
            m."variantId",
            m."customPrice",
            pv."sku",
            p."name" AS "productName"
          FROM "DealerPriceMapping" m
          INNER JOIN "ProductVariant" pv ON pv."id" = m."variantId"
          INNER JOIN "Product" p ON p."id" = pv."productId"
          WHERE m."dealerId" = ${dealerId}
          ORDER BY p."name" ASC, pv."sku" ASC
        `);
            }
            catch (error) {
                if (this.isDealerTableMissing(error)) {
                    return [];
                }
                throw error;
            }
        });
    }
    getDealerPriceMap(dealerId, variantIds) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!variantIds.length) {
                return new Map();
            }
            try {
                const prices = yield database_config_1.default.$queryRaw(client_1.Prisma.sql `
          SELECT
            "variantId",
            "customPrice"
          FROM "DealerPriceMapping"
          WHERE "dealerId" = ${dealerId}
            AND "variantId" IN (${client_1.Prisma.join(variantIds)})
        `);
                return new Map(prices.map((price) => [price.variantId, price.customPrice]));
            }
            catch (error) {
                if (this.isDealerTableMissing(error)) {
                    return new Map();
                }
                throw error;
            }
        });
    }
}
exports.UserRepository = UserRepository;
