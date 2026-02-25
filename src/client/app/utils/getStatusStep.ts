export default function getStatusStep(status) {
  const normalized = String(status || "").toUpperCase();

  switch (normalized) {
    case "DELIVERED":
      return 3;
    case "CONFIRMED":
    case "PROCESSING":
    case "SHIPPED":
    case "IN_TRANSIT":
      return 2;
    case "REJECTED":
      return 2;
    case "PLACED":
    case "PENDING":
    default:
      return 1;
  }
}
