"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cookieOptions = exports.cookieParserOptions = void 0;
const config_1 = require("@/config");
exports.cookieParserOptions = {};
exports.cookieOptions = {
    httpOnly: true,
    secure: config_1.config.isProduction,
    sameSite: config_1.config.security.cookieSameSite,
    path: "/",
    domain: config_1.config.security.cookieDomain,
};
