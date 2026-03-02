"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("@/config");
const isDevelopment = config_1.config.isDevelopment;
const debugLog = (...args) => {
    if (isDevelopment) {
        console.log(...args);
    }
};
