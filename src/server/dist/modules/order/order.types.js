"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const isDevelopment = process.env.NODE_ENV !== "production";
const debugLog = (...args) => {
    if (isDevelopment) {
        console.log(...args);
    }
};
