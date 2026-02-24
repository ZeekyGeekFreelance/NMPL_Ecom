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
exports.AuthRepository = void 0;
const database_config_1 = __importDefault(require("@/infra/database/database.config"));
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
const AppError_1 = __importDefault(require("@/shared/errors/AppError"));
const authUtils_1 = require("@/shared/utils/authUtils");
class AuthRepository {
    isDealerTableMissing(error) {
        return (error instanceof Error &&
            error.message.includes('relation "DealerProfile" does not exist'));
    }
    findUserByEmail(email) {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.user.findFirst({
                where: {
                    email: {
                        equals: email,
                        mode: "insensitive",
                    },
                },
            });
        });
    }
    findUserByEmailWithPassword(email) {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.user.findFirst({
                where: {
                    email: {
                        equals: email,
                        mode: "insensitive",
                    },
                },
                select: {
                    id: true,
                    password: true,
                    role: true,
                    name: true,
                    email: true,
                    avatar: true,
                },
            });
        });
    }
    findUserById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield database_config_1.default.user.findUnique({
                where: { id },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    avatar: true,
                },
            });
            if (!user) {
                return null;
            }
            const dealerProfile = yield this.findDealerProfileByUserId(user.id);
            return Object.assign(Object.assign({}, user), { dealerProfile });
        });
    }
    createUser(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const hashedPassword = yield authUtils_1.passwordUtils.hashPassword(data.password);
            return database_config_1.default.user.create({
                data: Object.assign(Object.assign({}, data), { password: hashedPassword }),
                select: {
                    id: true,
                    name: true,
                    email: true,
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
                    throw new AppError_1.default(503, "Dealer tables are not available. Run Prisma migrations before dealer registration.");
                }
                throw error;
            }
            return this.findDealerProfileByUserId(data.userId);
        });
    }
    updateUserEmailVerification(userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.user.update({
                where: { id: userId },
                data,
            });
        });
    }
    updateUserPasswordReset(email, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const nextData = Object.assign({}, data);
            if (typeof nextData.password === "string") {
                nextData.password = yield authUtils_1.passwordUtils.hashPassword(nextData.password);
            }
            const user = yield this.findUserByEmail(email);
            if (!user) {
                return null;
            }
            return database_config_1.default.user.update({
                where: { id: user.id },
                data: nextData,
            });
        });
    }
    findUserByResetToken(hashedToken) {
        return __awaiter(this, void 0, void 0, function* () {
            return database_config_1.default.user.findFirst({
                where: {
                    resetPasswordToken: hashedToken,
                    resetPasswordTokenExpiresAt: { gt: new Date() },
                },
            });
        });
    }
    updateUserPassword(userId, password) {
        return __awaiter(this, void 0, void 0, function* () {
            const hashedPassword = yield authUtils_1.passwordUtils.hashPassword(password);
            return database_config_1.default.user.update({
                where: { id: userId },
                data: {
                    password: hashedPassword,
                    resetPasswordToken: null,
                    resetPasswordTokenExpiresAt: null,
                },
            });
        });
    }
}
exports.AuthRepository = AuthRepository;
