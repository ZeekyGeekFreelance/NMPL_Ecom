"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregateMonthlyTrends = void 0;
const aggregateMonthlyTrends = (orders, orderItems, users) => {
    // ? Define the structure => { "Jan": { revenue: 0, orders: 0, sales: 0, users: 0 } }
    const monthlyData = {};
    const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ];
    // Initialize monthly data for all months to ensure consistent output.
    months.forEach((_, index) => {
        monthlyData[index + 1] = { revenue: 0, orders: 0, sales: 0, users: 0 };
    });
    const usersByMonth = new Map();
    // Aggregate data by month.
    orders.forEach((order) => {
        const month = order.orderDate.getMonth() + 1;
        monthlyData[month].revenue += order.amount;
        monthlyData[month].orders += 1;
        if (order.userId) {
            if (!usersByMonth.has(month)) {
                usersByMonth.set(month, new Set());
            }
            usersByMonth.get(month).add(order.userId);
        }
    });
    orderItems.forEach((item) => {
        var _a;
        const monthSource = ((_a = item.order) === null || _a === void 0 ? void 0 : _a.orderDate) || item.createdAt;
        const month = monthSource.getMonth() + 1;
        monthlyData[month].sales += item.quantity;
    });
    if (usersByMonth.size > 0) {
        usersByMonth.forEach((userIds, month) => {
            monthlyData[month].users = userIds.size;
        });
    }
    else {
        users.forEach((user) => {
            const month = user.createdAt.getMonth() + 1;
            monthlyData[month].users += 1;
        });
    }
    // Map data to arrays for charting.
    return {
        labels: months,
        revenue: months.map((_, index) => Number(monthlyData[index + 1].revenue.toFixed(2))),
        orders: months.map((_, index) => monthlyData[index + 1].orders),
        sales: months.map((_, index) => monthlyData[index + 1].sales),
        users: months.map((_, index) => monthlyData[index + 1].users),
    };
};
exports.aggregateMonthlyTrends = aggregateMonthlyTrends;
