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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDealerPriceMap = exports.isDealerTableMissing = void 0;
const client_1 = require("@prisma/client");
const isDealerTableMissing = (error) => {
    if (!(error instanceof Error)) {
        return false;
    }
    return (error.message.includes('relation "DealerProfile" does not exist') ||
        error.message.includes('relation "DealerPriceMapping" does not exist'));
};
exports.isDealerTableMissing = isDealerTableMissing;
const getDealerPriceMap = (prisma, userId, variantIds) => __awaiter(void 0, void 0, void 0, function* () {
    if (!userId || !variantIds.length) {
        return new Map();
    }
    try {
        const dealerProfileRows = yield prisma.$queryRaw(client_1.Prisma.sql `
        SELECT "status"
        FROM "DealerProfile"
        WHERE "userId" = ${userId}
        LIMIT 1
      `);
        if (!dealerProfileRows.length || dealerProfileRows[0].status !== "APPROVED") {
            return new Map();
        }
        const priceRows = yield prisma.$queryRaw(client_1.Prisma.sql `
        SELECT "variantId", "customPrice"
        FROM "DealerPriceMapping"
        WHERE "dealerId" = ${userId}
          AND "variantId" IN (${client_1.Prisma.join(variantIds)})
      `);
        return new Map(priceRows.map((row) => [row.variantId, row.customPrice]));
    }
    catch (error) {
        if ((0, exports.isDealerTableMissing)(error)) {
            return new Map();
        }
        throw error;
    }
});
exports.getDealerPriceMap = getDealerPriceMap;
