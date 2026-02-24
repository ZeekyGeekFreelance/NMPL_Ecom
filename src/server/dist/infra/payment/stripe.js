"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStripeConfigured = void 0;
const stripe_1 = __importDefault(require("stripe"));
exports.isStripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
const stripe = exports.isStripeConfigured
    ? new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2025-03-31.basil",
    })
    : null;
exports.default = stripe;
