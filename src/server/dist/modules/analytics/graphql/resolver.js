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
exports.analyticsResolvers = void 0;
const productPerformance_1 = __importDefault(require("./resolvers/productPerformance"));
const yearRange_1 = __importDefault(require("./resolvers/yearRange"));
const interactionAnalytics_1 = __importDefault(require("./resolvers/interactionAnalytics"));
const searchDashboard_1 = require("./resolvers/searchDashboard");
const orderAnalytics_1 = __importDefault(require("./resolvers/orderAnalytics"));
const revenueAnalytics_1 = __importDefault(require("./resolvers/revenueAnalytics"));
const userAnalytics_1 = __importDefault(require("./resolvers/userAnalytics"));
const abandonedCartAnalytics_1 = __importDefault(require("./resolvers/abandonedCartAnalytics"));
const DASHBOARD_ROLES = new Set(["ADMIN", "SUPERADMIN"]);
const withDashboardAuthorization = (resolver) => {
    return (parent, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c;
        const role = ((_b = (_a = context === null || context === void 0 ? void 0 : context.req) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.role) || ((_c = context === null || context === void 0 ? void 0 : context.user) === null || _c === void 0 ? void 0 : _c.role);
        if (!role || !DASHBOARD_ROLES.has(role)) {
            throw new Error("Forbidden");
        }
        return resolver(parent, args, context, info);
    });
};
const queryResolvers = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, orderAnalytics_1.default.Query), revenueAnalytics_1.default.Query), userAnalytics_1.default.Query), yearRange_1.default.Query), interactionAnalytics_1.default.Query), productPerformance_1.default.Query), searchDashboard_1.searchDashboardResolver.Query), abandonedCartAnalytics_1.default.Query);
exports.analyticsResolvers = {
    Query: Object.fromEntries(Object.entries(queryResolvers).map(([name, resolver]) => [
        name,
        withDashboardAuthorization(resolver),
    ])),
};
