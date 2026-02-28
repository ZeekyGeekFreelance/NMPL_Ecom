export const getStatusColor = (status) => {
  const normalized = String(status || "").toUpperCase();

  switch (normalized) {
    case "PENDING_VERIFICATION":
    case "PLACED":
      return "bg-amber-100 text-amber-800";
    case "WAITLISTED":
      return "bg-orange-100 text-orange-800";
    case "AWAITING_PAYMENT":
      return "bg-blue-100 text-blue-800";
    case "CONFIRMED":
      return "bg-green-100 text-green-800";
    case "DELIVERED":
      return "bg-emerald-100 text-emerald-800";
    case "QUOTATION_REJECTED":
    case "QUOTATION_EXPIRED":
    case "REJECTED":
    case "CANCELED":
    case "RETURNED":
    case "REFUNDED":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};
