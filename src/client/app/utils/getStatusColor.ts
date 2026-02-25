export const getStatusColor = (status) => {
  const normalized = String(status || "").toUpperCase();

  switch (normalized) {
    case "PLACED":
    case "PENDING":
      return "bg-yellow-100 text-yellow-800";
    case "CONFIRMED":
    case "PROCESSING":
    case "SHIPPED":
    case "IN_TRANSIT":
      return "bg-blue-100 text-blue-800";
    case "DELIVERED":
      return "bg-green-100 text-green-800";
    case "REJECTED":
    case "CANCELED":
    case "RETURNED":
    case "REFUNDED":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};
