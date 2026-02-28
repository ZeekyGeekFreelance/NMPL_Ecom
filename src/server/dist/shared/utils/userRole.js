"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCustomerTypeFromUser = exports.resolveCustomerType = exports.resolveEffectiveRoleFromUser = exports.resolveEffectiveRole = exports.isAdminRole = void 0;
const normalizeUpper = (value) => String(value !== null && value !== void 0 ? value : "")
    .trim()
    .toUpperCase();
const isAdminRole = (role) => {
    const normalized = normalizeUpper(role);
    return normalized === "ADMIN" || normalized === "SUPERADMIN";
};
exports.isAdminRole = isAdminRole;
const resolveEffectiveRole = ({ role, dealerStatus, }) => {
    const normalizedRole = normalizeUpper(role);
    if (normalizedRole === "SUPERADMIN") {
        return "SUPERADMIN";
    }
    if (normalizedRole === "ADMIN") {
        return "ADMIN";
    }
    const normalizedDealerStatus = normalizeUpper(dealerStatus);
    if (normalizedDealerStatus === "APPROVED") {
        return "DEALER";
    }
    return "USER";
};
exports.resolveEffectiveRole = resolveEffectiveRole;
const resolveEffectiveRoleFromUser = (user) => {
    var _a, _b;
    return (0, exports.resolveEffectiveRole)({
        role: user === null || user === void 0 ? void 0 : user.role,
        dealerStatus: (_b = (_a = user === null || user === void 0 ? void 0 : user.dealerProfile) === null || _a === void 0 ? void 0 : _a.status) !== null && _b !== void 0 ? _b : user === null || user === void 0 ? void 0 : user.dealerStatus,
    });
};
exports.resolveEffectiveRoleFromUser = resolveEffectiveRoleFromUser;
const resolveCustomerType = (input) => (0, exports.resolveEffectiveRole)(input) === "DEALER" ? "DEALER" : "USER";
exports.resolveCustomerType = resolveCustomerType;
const resolveCustomerTypeFromUser = (user) => {
    var _a, _b;
    return (0, exports.resolveCustomerType)({
        role: user === null || user === void 0 ? void 0 : user.role,
        dealerStatus: (_b = (_a = user === null || user === void 0 ? void 0 : user.dealerProfile) === null || _a === void 0 ? void 0 : _a.status) !== null && _b !== void 0 ? _b : user === null || user === void 0 ? void 0 : user.dealerStatus,
    });
};
exports.resolveCustomerTypeFromUser = resolveCustomerTypeFromUser;
