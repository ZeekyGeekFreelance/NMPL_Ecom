export default function getStatusStep(status) {
  const normalized = String(status || "").toUpperCase();

  switch (normalized) {
    case "DELIVERED":
      return 4;
    case "CONFIRMED":
      return 3;
    case "AWAITING_PAYMENT":
      return 2;
    case "WAITLISTED":
      return 2;
    case "QUOTATION_REJECTED":
    case "QUOTATION_EXPIRED":
      return 3;
    case "PENDING_VERIFICATION":
    case "PLACED":
    default:
      return 1;
  }
}
