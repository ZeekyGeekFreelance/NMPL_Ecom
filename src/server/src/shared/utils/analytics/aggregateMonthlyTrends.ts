export const aggregateMonthlyTrends = (
  orders: any[],
  orderItems: any[],
  users: any[]
) => {
  // ? Define the structure => { "Jan": { revenue: 0, orders: 0, sales: 0, users: 0 } }
  const monthlyData: {
    [key: string]: {
      revenue: number;
      orders: number;
      sales: number;
      users: number;
    };
  } = {};

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

  const usersByMonth = new Map<number, Set<string>>();

  // Aggregate data by month.
  orders.forEach((order) => {
    const month = order.orderDate.getMonth() + 1;
    monthlyData[month].revenue += order.amount;
    monthlyData[month].orders += 1;

    if (order.userId) {
      if (!usersByMonth.has(month)) {
        usersByMonth.set(month, new Set<string>());
      }
      usersByMonth.get(month)!.add(order.userId);
    }
  });

  orderItems.forEach((item) => {
    const monthSource = item.order?.orderDate || item.createdAt;
    const month = monthSource.getMonth() + 1;
    monthlyData[month].sales += item.quantity;
  });

  if (usersByMonth.size > 0) {
    usersByMonth.forEach((userIds, month) => {
      monthlyData[month].users = userIds.size;
    });
  } else {
    users.forEach((user) => {
      const month = user.createdAt.getMonth() + 1;
      monthlyData[month].users += 1;
    });
  }

  // Map data to arrays for charting.
  return {
    labels: months,
    revenue: months.map((_, index) =>
      Number(monthlyData[index + 1].revenue.toFixed(2))
    ),
    orders: months.map((_, index) => monthlyData[index + 1].orders),
    sales: months.map((_, index) => monthlyData[index + 1].sales),
    users: months.map((_, index) => monthlyData[index + 1].users),
  };
};
