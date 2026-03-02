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
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_config_1 = __importDefault(require("@/infra/database/database.config"));
const config_1 = require("@/config");
const optionalAuth = (req, _res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const accessToken = req.cookies.accessToken;
    if (!accessToken) {
        return next();
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(accessToken, config_1.config.auth.accessTokenSecret);
        const user = yield database_config_1.default.user.findUnique({
            where: { id: String(decoded.id) },
            select: { id: true, role: true },
        });
        if (user) {
            req.user = user;
        }
    }
    catch (_a) {
        // Optional auth should gracefully continue for guests or invalid tokens.
    }
    next();
});
exports.default = optionalAuth;
