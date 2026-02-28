"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTopCustomers = void 0;
const userRole_1 = require("@/shared/utils/userRole");
const generateTopCustomers = (users, engagementScores) => {
    return users
        .map((user) => ({
        id: user.id,
        name: user.name || "Unknown",
        email: user.email,
        customerType: (0, userRole_1.resolveCustomerTypeFromUser)(user),
        orderCount: user.orders.length,
        totalSpent: user.orders.reduce((sum, order) => sum + order.amount, 0),
        engagementScore: engagementScores[user.id] || 0,
    }))
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 5);
};
exports.generateTopCustomers = generateTopCustomers;
