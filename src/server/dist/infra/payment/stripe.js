"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStripeConfigured = void 0;
const stripe_1 = __importDefault(require("stripe"));
const config_1 = require("@/config");
exports.isStripeConfigured = Boolean(config_1.config.payment.stripeSecretKey);
const stripe = exports.isStripeConfigured
    ? new stripe_1.default(config_1.config.payment.stripeSecretKey, {
        apiVersion: "2025-03-31.basil",
    })
    : null;
exports.default = stripe;
