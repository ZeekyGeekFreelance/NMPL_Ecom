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
exports.pingDB = exports.disconnectDB = exports.connectDB = void 0;
const client_1 = require("@prisma/client");
const config_1 = require("@/config");
const prisma = new client_1.PrismaClient({
    datasources: {
        db: {
            url: config_1.config.database.url,
        },
    },
});
const connectDB = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield prisma.$connect();
        console.log("Database connected successfully.");
    }
    catch (error) {
        console.error("Database connection failed.", error);
        throw error;
    }
});
exports.connectDB = connectDB;
const disconnectDB = () => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma.$disconnect();
});
exports.disconnectDB = disconnectDB;
const pingDB = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield prisma.$queryRaw `SELECT 1`;
        return true;
    }
    catch (_a) {
        return false;
    }
});
exports.pingDB = pingDB;
exports.default = prisma;
